/*
 * testbench firmware — MSP430FR2355 LaunchPad
 *
 * Sends JSON telemetry frames over UART to the Pi Zero 2 W bridge.
 * UART: eUSCI_A1 — P4.2 TX / P4.3 RX — 9600 baud, 8N1
 *
 * Build with TI Code Composer Studio or msp430-gcc:
 *   msp430-elf-gcc -mmcu=msp430fr2355 -O2 -o firmware.elf main.c
 */

#include <msp430.h>
#include <stdint.h>
#include <string.h>
#include <stdio.h>

/* ── UART ─────────────────────────────────────────────────────────────────── */
#define UART_BAUD  9600UL
#define SMCLK_HZ   1000000UL   /* 1 MHz after clock setup */

void uart_init(void) {
    /* P4.2 = UCA1TXD, P4.3 = UCA1RXD */
    P4SEL0 |= BIT2 | BIT3;
    P4SEL1 &= ~(BIT2 | BIT3);

    UCA1CTLW0  = UCSWRST;
    UCA1CTLW0 |= UCSSEL__SMCLK;
    UCA1BRW    = (uint16_t)(SMCLK_HZ / UART_BAUD);
    UCA1MCTLW  = UCOS16 | ((((SMCLK_HZ / UART_BAUD) - (SMCLK_HZ / UART_BAUD / 16) * 16) << 4) & 0xF0);
    UCA1CTLW0 &= ~UCSWRST;
}

void uart_putc(char c) {
    while (!(UCA1IFG & UCTXIFG));
    UCA1TXBUF = c;
}

void uart_puts(const char *s) {
    while (*s) uart_putc(*s++);
}

void uart_send_json(const char *json) {
    uart_puts(json);
    uart_putc('\n');
}

/* ── ADC — voltage and current sense ─────────────────────────────────────── */
/*
 * A0 (P1.0) — voltage divider on VDD rail  (R1=10k, R2=10k → Vadc = VDD/2)
 * A1 (P1.1) — INA219 VOUT or shunt amp output for current
 * A4 (P1.4) — NTC thermistor (10k NTC + 10k series to VCC)
 *
 * All referenced to internal 2.0V reference.
 */
#define ADC_REF_MV   2000
#define ADC_COUNTS   4096   /* 12-bit */

void adc_init(void) {
    ADCCTL0 = ADCSHT_2 | ADCON;
    ADCCTL1 = ADCSHP;
    ADCCTL2 = ADCRES_2;  /* 12-bit */
    ADCMCTL0 = ADCINCH_0 | ADCSREF_1;  /* A0, Vref=2V */
    PMMCTL0_H = PMMPW_H;
    PMMCTL2   = INTREFEN | REFVSEL_1;  /* 2.0V internal ref */
    __delay_cycles(400);
    PMMCTL0_H = 0;
}

uint16_t adc_read(uint8_t channel) {
    ADCMCTL0 = (ADCMCTL0 & ~ADCINCH_15) | channel | ADCSREF_1;
    ADCCTL0 |= ADCENC | ADCSC;
    while (ADCCTL1 & ADCBUSY);
    return ADCMEM0;
}

/* returns millivolts */
uint32_t adc_to_mv(uint16_t counts) {
    return ((uint32_t)counts * ADC_REF_MV) / ADC_COUNTS;
}

/* Voltage rail: divider 1:2 so actual V = Vadc * 2 */
float read_voltage(void) {
    uint32_t mv = adc_to_mv(adc_read(0)) * 2;
    return (float)mv / 1000.0f;
}

/*
 * Current: INA219 analog-output amp (Vout = 0.5V + I*0.1V/mA example gain).
 * Adjust gain constant to match your shunt + amp configuration.
 */
float read_current_ma(void) {
    uint32_t mv = adc_to_mv(adc_read(1));
    if (mv < 500) return 0.0f;  /* offset */
    return (float)(mv - 500) * 0.1f;
}

/*
 * Temperature: NTC 10k B=3950 with 10k series resistor to 3.3V.
 * Steinhart-Hart simplified: T = B / ln(R/R0) − 273.15
 * R0=10k at 25°C, B=3950.
 * Vadc measured across NTC (bottom of divider).
 */
float read_temperature(void) {
    uint32_t mv  = adc_to_mv(adc_read(4));
    /* Vcc for divider ≈ 3300 mV, but we reference to 2V so scale */
    /* Approximate: just use raw mV mapped to resistance */
    float vcc  = 3300.0f;
    float vadc = (float)mv;
    if (vadc <= 0.0f || vadc >= vcc) return -99.0f;
    float r_ntc = 10000.0f * vadc / (vcc - vadc);
    float b  = 3950.0f;
    float r0 = 10000.0f;
    float t0 = 298.15f;  /* 25°C in K */
    float inv_t = (1.0f / t0) + (1.0f / b) * (r_ntc > 0 ? __builtin_logf(r_ntc / r0) : 0.0f);
    return (1.0f / inv_t) - 273.15f;
}

/* ── GPIO sense — P1.4–P1.7 as digital inputs ────────────────────────────── */
void gpio_init(void) {
    P1DIR &= ~(BIT4 | BIT5 | BIT6 | BIT7);
    P1REN |=  (BIT4 | BIT5 | BIT6 | BIT7);
    P1OUT |=  (BIT4 | BIT5 | BIT6 | BIT7);  /* pull-up */
}

/* ── clock: set SMCLK to 1 MHz ────────────────────────────────────────────── */
void clock_init(void) {
    __bis_SR_register(SCG0);
    CSCTL3 = SELREF__REFOCLK;
    CSCTL1 = DCOFSEL_0;  /* 1 MHz */
    CSCTL2 = SELA__REFOCLK | SELS__DCOCLK | SELM__DCOCLK;
    CSCTL4 = DIVS__1;
    __bic_SR_register(SCG0);
    __delay_cycles(3);
}

/* ── timer for ~1s tick ───────────────────────────────────────────────────── */
volatile uint8_t tick = 0;

void timer_init(void) {
    TB0CTL  = TBSSEL__ACLK | MC__CONTINUOUS | TBCLR;
    TB0CCTL0 = CCIE;
    TB0CCR0  = 32768;  /* ACLK=32768 Hz → 1s */
}

#pragma vector = TIMER0_B0_VECTOR
__interrupt void Timer_B0(void) {
    TB0CCR0 += 32768;
    tick = 1;
}

/* ── main ─────────────────────────────────────────────────────────────────── */
int main(void) {
    WDTCTL = WDTPW | WDTHOLD;
    PM5CTL0 &= ~LOCKLPM5;

    clock_init();
    uart_init();
    adc_init();
    gpio_init();
    timer_init();

    __enable_interrupt();

    /* announce ourselves */
    uart_send_json("{\"type\":\"heartbeat\",\"hardwareId\":\"msp430-01\"}");

    uint32_t seq = 0;
    char buf[256];

    while (1) {
        __bis_SR_register(LPM0_bits);  /* sleep until tick ISR wakes us */

        if (!tick) continue;
        tick = 0;

        float voltage  = read_voltage();
        float current  = read_current_ma();
        float temp     = read_temperature();

        uint8_t p14 = (P1IN & BIT4) ? 1 : 0;
        uint8_t p15 = (P1IN & BIT5) ? 1 : 0;
        uint8_t p16 = (P1IN & BIT6) ? 1 : 0;
        uint8_t p17 = (P1IN & BIT7) ? 1 : 0;

        /* emit metrics frame — Pi bridge parses and publishes to MQTT */
        snprintf(buf, sizeof(buf),
            "{\"type\":\"metrics\","
            "\"temperature\":%.1f,"
            "\"voltage\":%.3f,"
            "\"currentMa\":%.1f,"
            "\"gpio\":{\"P1.4\":%s,\"P1.5\":%s,\"P1.6\":%s,\"P1.7\":%s}}",
            temp, voltage, current,
            p14 ? "true" : "false",
            p15 ? "true" : "false",
            p16 ? "true" : "false",
            p17 ? "true" : "false"
        );
        uart_send_json(buf);

        seq++;
    }
}
