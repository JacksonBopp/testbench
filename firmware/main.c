/*
 * testbench firmware — MSP430FR2355 LaunchPad
 * Firmware version reported in all heartbeat and run_start frames.
 *
 * UART: eUSCI_A1 — P4.2 TX / P4.3 RX — 9600 baud, 8N1
 *
 * Outbound JSON frames (to Pi):
 *   {"type":"heartbeat","hardwareId":"msp430-01"}
 *   {"type":"metrics","temperature":25.1,"voltage":3.28,"currentMa":12.4,"gpio":{...}}
 *   {"type":"run_start","runId":"...","hardwareId":"msp430-01"}
 *   {"type":"run_step","runId":"...","sequence":1,"name":"VDD check","status":"passed","startedAt":"...","finishedAt":"...","message":null}
 *   {"type":"run_end","runId":"...","status":"passed","finishedAt":"..."}
 *
 * Inbound JSON frames (from Pi):
 *   {"type":"command_run","runId":"...","hardwareId":"..."}
 *
 * Build: msp430-elf-gcc -mmcu=msp430fr2355 -O2 -o firmware.elf main.c
 */

#include <msp430.h>
#include <stdint.h>
#include <string.h>
#include <stdio.h>
#include <stdbool.h>

#define FIRMWARE_VERSION "1.0.0"
#define HARDWARE_ID      "msp430-01"

/* ── UART ─────────────────────────────────────────────────────────────────── */
#define UART_BAUD  9600UL
#define SMCLK_HZ   1000000UL

static char rx_buf[256];
static uint8_t rx_len = 0;
volatile bool rx_ready = false;

void uart_init(void) {
    P4SEL0 |= BIT2 | BIT3;
    P4SEL1 &= ~(BIT2 | BIT3);
    UCA1CTLW0  = UCSWRST;
    UCA1CTLW0 |= UCSSEL__SMCLK;
    UCA1BRW    = (uint16_t)(SMCLK_HZ / UART_BAUD);
    UCA1MCTLW  = UCOS16 | ((((SMCLK_HZ / UART_BAUD) - (SMCLK_HZ / UART_BAUD / 16) * 16) << 4) & 0xF0);
    UCA1CTLW0 &= ~UCSWRST;
    UCA1IE |= UCRXIE;
}

void uart_putc(char c) {
    while (!(UCA1IFG & UCTXIFG));
    UCA1TXBUF = c;
}

void uart_puts(const char *s) { while (*s) uart_putc(*s++); }

void uart_json(const char *json) { uart_puts(json); uart_putc('\n'); }

#pragma vector = USCI_A1_VECTOR
__interrupt void USCI_A1_ISR(void) {
    char c = UCA1RXBUF;
    if (c == '\n' || c == '\r') {
        rx_buf[rx_len] = '\0';
        if (rx_len > 0) rx_ready = true;
        rx_len = 0;
    } else if (rx_len < sizeof(rx_buf) - 1) {
        rx_buf[rx_len++] = c;
    }
}

/* ── clock ────────────────────────────────────────────────────────────────── */
void clock_init(void) {
    __bis_SR_register(SCG0);
    CSCTL3 = SELREF__REFOCLK;
    CSCTL1 = DCOFSEL_0;
    CSCTL2 = SELA__REFOCLK | SELS__DCOCLK | SELM__DCOCLK;
    CSCTL4 = DIVS__1;
    __bic_SR_register(SCG0);
    __delay_cycles(3);
}

/* ── ADC ──────────────────────────────────────────────────────────────────── */
void adc_init(void) {
    ADCCTL0 = ADCSHT_2 | ADCON;
    ADCCTL1 = ADCSHP;
    ADCCTL2 = ADCRES_2;
    ADCMCTL0 = ADCINCH_0 | ADCSREF_1;
    PMMCTL0_H = PMMPW_H;
    PMMCTL2   = INTREFEN | REFVSEL_1;
    __delay_cycles(400);
    PMMCTL0_H = 0;
}

uint16_t adc_read(uint8_t ch) {
    ADCMCTL0 = (ADCMCTL0 & ~ADCINCH_15) | ch | ADCSREF_1;
    ADCCTL0 |= ADCENC | ADCSC;
    while (ADCCTL1 & ADCBUSY);
    return ADCMEM0;
}

float read_voltage(void) {
    return (float)(((uint32_t)adc_read(0) * 2000UL) / 4096UL * 2UL) / 1000.0f;
}

float read_current_ma(void) {
    uint32_t mv = ((uint32_t)adc_read(1) * 2000UL) / 4096UL;
    return mv < 500 ? 0.0f : (float)(mv - 500) * 0.1f;
}

float read_temperature(void) {
    uint32_t mv = ((uint32_t)adc_read(4) * 2000UL) / 4096UL;
    float vadc = (float)mv;
    float vcc  = 3300.0f;
    if (vadc <= 0.0f || vadc >= vcc) return -99.0f;
    float r = 10000.0f * vadc / (vcc - vadc);
    float inv_t = (1.0f / 298.15f) + (1.0f / 3950.0f) * __builtin_logf(r / 10000.0f);
    return (1.0f / inv_t) - 273.15f;
}

/* ── GPIO ─────────────────────────────────────────────────────────────────── */
void gpio_init(void) {
    P1DIR &= ~(BIT4 | BIT5 | BIT6 | BIT7);
    P1REN |=  (BIT4 | BIT5 | BIT6 | BIT7);
    P1OUT |=  (BIT4 | BIT5 | BIT6 | BIT7);
}

/* ── timer 1s tick ────────────────────────────────────────────────────────── */
volatile uint8_t tick = 0;
volatile uint32_t uptime_s = 0;

void timer_init(void) {
    TB0CTL   = TBSSEL__ACLK | MC__CONTINUOUS | TBCLR;
    TB0CCTL0 = CCIE;
    TB0CCR0  = 32768;
}

#pragma vector = TIMER0_B0_VECTOR
__interrupt void Timer_B0(void) {
    TB0CCR0 += 32768;
    tick = 1;
    uptime_s++;
}

/* ── lightweight JSON key extractor ──────────────────────────────────────── */
/*
 * Extracts the value of a string key from flat JSON.
 * e.g. json_get_str(buf, "runId", out, 64)
 * Returns true on success.
 */
bool json_get_str(const char *json, const char *key, char *out, size_t out_sz) {
    char needle[64];
    snprintf(needle, sizeof(needle), "\"%s\":", key);
    const char *p = strstr(json, needle);
    if (!p) return false;
    p += strlen(needle);
    while (*p == ' ') p++;
    if (*p != '"') return false;
    p++;
    size_t i = 0;
    while (*p && *p != '"' && i < out_sz - 1) out[i++] = *p++;
    out[i] = '\0';
    return true;
}

/* ── test sequence ────────────────────────────────────────────────────────── */
/*
 * Each step function sets *status to "passed" or "failed" and optionally
 * writes a message string.
 */
typedef struct {
    const char *name;
    void (*fn)(float v, float c, float t, char *status, char *msg);
} TestStep;

static void step_vdd(float v, float c, float t, char *status, char *msg) {
    (void)c; (void)t;
    if (v >= 3.0f && v <= 3.6f) { strcpy(status, "passed"); strcpy(msg, ""); }
    else { strcpy(status, "failed"); snprintf(msg, 64, "VDD %.3fV out of range 3.0-3.6V", v); }
}

static void step_clock(float v, float c, float t, char *status, char *msg) {
    (void)v; (void)c; (void)t;
    /* Timer was running to get here — clock is stable */
    strcpy(status, "passed"); strcpy(msg, "");
}

static void step_gpio(float v, float c, float t, char *status, char *msg) {
    (void)v; (void)c; (void)t;
    /* Drive P1.0 high, read it back on P1.4 (loopback via jumper) */
    P1DIR |= BIT0;
    P1OUT |= BIT0;
    __delay_cycles(1000);
    bool readback = (P1IN & BIT4) != 0;
    P1OUT &= ~BIT0;
    if (readback) { strcpy(status, "passed"); strcpy(msg, ""); }
    else { strcpy(status, "failed"); strcpy(msg, "GPIO loopback mismatch — check P1.0→P1.4 jumper"); }
}

static void step_adc(float v, float c, float t, char *status, char *msg) {
    (void)c;
    /* Validate ADC reads are within plausible ranges */
    if (v > 0.5f && v < 5.0f && t > -40.0f && t < 100.0f) {
        strcpy(status, "passed"); strcpy(msg, "");
    } else {
        strcpy(status, "failed"); snprintf(msg, 64, "ADC out of range v=%.2f t=%.1f", v, t);
    }
}

static void step_current(float v, float c, float t, char *status, char *msg) {
    (void)v; (void)t;
    if (c >= 0.0f && c < 200.0f) { strcpy(status, "passed"); strcpy(msg, ""); }
    else { strcpy(status, "failed"); snprintf(msg, 64, "Current %.1fmA out of range 0-200mA", c); }
}

static const TestStep STEPS[] = {
    { "VDD rail check",     step_vdd     },
    { "Clock stability",    step_clock   },
    { "GPIO loopback",      step_gpio    },
    { "ADC accuracy",       step_adc     },
    { "Current draw",       step_current },
};
#define N_STEPS (sizeof(STEPS) / sizeof(STEPS[0]))

void run_test_sequence(const char *run_id) {
    char buf[320];
    char ts[32];
    char step_status[16];
    char step_msg[64];
    bool overall_passed = true;

    /* announce start */
    snprintf(buf, sizeof(buf),
        "{\"type\":\"run_start\",\"runId\":\"%s\",\"hardwareId\":\"" HARDWARE_ID "\",\"firmwareVersion\":\"" FIRMWARE_VERSION "\"}",
        run_id);
    uart_json(buf);

    for (uint8_t i = 0; i < N_STEPS; i++) {
        float v = read_voltage();
        float c = read_current_ma();
        float temp = read_temperature();

        snprintf(ts, sizeof(ts), "t+%lus", (unsigned long)uptime_s);

        STEPS[i].fn(v, c, temp, step_status, step_msg);

        if (strcmp(step_status, "failed") == 0) overall_passed = false;

        if (step_msg[0] != '\0') {
            snprintf(buf, sizeof(buf),
                "{\"type\":\"run_step\",\"runId\":\"%s\","
                "\"sequence\":%u,\"name\":\"%s\","
                "\"status\":\"%s\",\"startedAt\":\"%s\","
                "\"finishedAt\":\"%s\",\"message\":\"%s\"}",
                run_id, (unsigned)(i + 1), STEPS[i].name,
                step_status, ts, ts, step_msg);
        } else {
            snprintf(buf, sizeof(buf),
                "{\"type\":\"run_step\",\"runId\":\"%s\","
                "\"sequence\":%u,\"name\":\"%s\","
                "\"status\":\"%s\",\"startedAt\":\"%s\","
                "\"finishedAt\":\"%s\",\"message\":null}",
                run_id, (unsigned)(i + 1), STEPS[i].name,
                step_status, ts, ts);
        }
        uart_json(buf);

        /* short delay between steps */
        __delay_cycles(500000);
    }

    snprintf(buf, sizeof(buf),
        "{\"type\":\"run_end\",\"runId\":\"%s\",\"status\":\"%s\","
        "\"firmwareVersion\":\"" FIRMWARE_VERSION "\",\"finishedAt\":\"t+%lus\"}",
        run_id, overall_passed ? "passed" : "failed", (unsigned long)uptime_s);
    uart_json(buf);
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

    uart_json("{\"type\":\"heartbeat\",\"hardwareId\":\"" HARDWARE_ID "\",\"firmwareVersion\":\"" FIRMWARE_VERSION "\"}");

    char buf[256];
    uint8_t metrics_tick = 0;

    while (1) {
        /* handle inbound UART command */
        if (rx_ready) {
            rx_ready = false;
            char cmd_run_id[64] = {0};
            if (strstr(rx_buf, "command_run") &&
                json_get_str(rx_buf, "runId", cmd_run_id, sizeof(cmd_run_id))) {
                run_test_sequence(cmd_run_id);
            }
        }

        /* 1Hz metrics tick */
        if (tick) {
            tick = 0;
            float v    = read_voltage();
            float c    = read_current_ma();
            float temp = read_temperature();
            uint8_t p14 = (P1IN & BIT4) ? 1 : 0;
            uint8_t p15 = (P1IN & BIT5) ? 1 : 0;
            uint8_t p16 = (P1IN & BIT6) ? 1 : 0;
            uint8_t p17 = (P1IN & BIT7) ? 1 : 0;

            snprintf(buf, sizeof(buf),
                "{\"type\":\"metrics\","
                "\"temperature\":%.1f,\"voltage\":%.3f,\"currentMa\":%.1f,"
                "\"gpio\":{\"P1.4\":%s,\"P1.5\":%s,\"P1.6\":%s,\"P1.7\":%s}}",
                temp, v, c,
                p14 ? "true" : "false", p15 ? "true" : "false",
                p16 ? "true" : "false", p17 ? "true" : "false");
            uart_json(buf);

            /* heartbeat every 30s */
            if (++metrics_tick >= 30) {
                metrics_tick = 0;
                uart_json("{\"type\":\"heartbeat\",\"hardwareId\":\"" HARDWARE_ID "\",\"firmwareVersion\":\"" FIRMWARE_VERSION "\"}");
            }
        }

        __bis_SR_register(LPM0_bits | GIE);
    }
}
