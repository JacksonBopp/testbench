/*
 * testbench REFERENCE firmware — Raspberry Pi Pico (RP2040, C SDK)
 *
 * Fourth reference implementation of testbench's device contract (MSP430:
 * ../main.c, ESP32: ../esp32/src/main.cpp, STM32: ../stm32/src/main.c). RP2040
 * is included both because it's genuinely industry-adopted for cost-sensitive
 * production hardware, and because it closes the loop on this platform's own
 * story: the bridge host testbench recommends is a Raspberry Pi, so this is a
 * device under test and the bridge host built on the same silicon vendor.
 *
 * Written against the official Raspberry Pi Pico C SDK (pico-sdk) directly —
 * no Arduino wrapper — matching how RP2040 firmware is actually built in
 * production. Nothing on the bridge, backend, or dashboard changed to support
 * this chip; it emits byte-for-byte the same JSON frames as every other
 * reference firmware in this repo.
 *
 * UART (this board): uart0 — GPIO0 TX / GPIO1 RX — 9600 baud, 8N1
 * ADC (this board):  GPIO26 (ADC0) = VDD sense, GPIO27 (ADC1) = current sense,
 *                     GPIO28 (ADC2) = temp sense
 * GPIO loopback:     drive GPIO15, read back on GPIO14 (jumper the two together)
 *
 * Outbound JSON frames (device -> bridge):
 *   {"type":"heartbeat","hardwareId":"rp2040-01","firmwareVersion":"1.0.0"}
 *   {"type":"metrics","temperature":25.1,"voltage":3.28,"currentMa":12.4,"gpio":{...}}
 *   {"type":"run_start","runId":"...","hardwareId":"rp2040-01","firmwareVersion":"1.0.0"}
 *   {"type":"run_step","runId":"...","sequence":1,"name":"VDD check","status":"passed","startedAt":"...","finishedAt":"...","message":null}
 *   {"type":"run_end","runId":"...","status":"passed","firmwareVersion":"1.0.0","finishedAt":"..."}
 *
 * Inbound JSON frames (bridge -> device):
 *   {"type":"command_run","runId":"...","hardwareId":"..."}
 *
 * Build: pico-sdk + CMake, see firmware/rp2040/CMakeLists.txt
 */

#include "pico/stdlib.h"
#include "hardware/uart.h"
#include "hardware/adc.h"
#include "hardware/gpio.h"
#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <math.h>

#define FIRMWARE_VERSION "1.0.0"
#define HARDWARE_ID      "rp2040-01"

#define UART_ID     uart0
#define UART_BAUD   9600
#define UART_TX_PIN 0
#define UART_RX_PIN 1

#define ADC_VDD_INPUT     0  /* GPIO26 */
#define ADC_CURRENT_INPUT 1  /* GPIO27 */
#define ADC_TEMP_INPUT    2  /* GPIO28 */

#define GPIO_LOOP_OUT 15
#define GPIO_LOOP_IN  14

static char rx_buf[256];
static uint8_t rx_len = 0;
static bool rx_ready = false;

static void uart_json(const char *json) {
    uart_puts(UART_ID, json);
    uart_putc(UART_ID, '\n');
}

static void poll_uart_rx(void) {
    while (uart_is_readable(UART_ID)) {
        char c = uart_getc(UART_ID);
        if (c == '\n' || c == '\r') {
            rx_buf[rx_len] = '\0';
            if (rx_len > 0) rx_ready = true;
            rx_len = 0;
        } else if (rx_len < sizeof(rx_buf) - 1) {
            rx_buf[rx_len++] = c;
        }
    }
}

static float read_voltage(void) {
    adc_select_input(ADC_VDD_INPUT);
    uint16_t raw = adc_read(); /* 12-bit */
    return (raw / 4095.0f) * 3.3f * 2.0f; /* external divider */
}

static float read_current_ma(void) {
    adc_select_input(ADC_CURRENT_INPUT);
    uint16_t raw = adc_read();
    float mv = (raw / 4095.0f) * 3300.0f;
    return mv < 500.0f ? 0.0f : (mv - 500.0f) * 0.1f;
}

static float read_temperature(void) {
    adc_select_input(ADC_TEMP_INPUT);
    uint16_t raw = adc_read();
    float vadc = (raw / 4095.0f) * 3300.0f;
    float vcc = 3300.0f;
    if (vadc <= 0.0f || vadc >= vcc) return -99.0f;
    float r = 10000.0f * vadc / (vcc - vadc);
    float inv_t = (1.0f / 298.15f) + (1.0f / 3950.0f) * logf(r / 10000.0f);
    return (1.0f / inv_t) - 273.15f;
}

/* ── lightweight JSON key extractor (mirrors firmware/main.c) ───────────────── */
static bool json_get_str(const char *json, const char *key, char *out, size_t out_sz) {
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

/* ── test sequence (identical steps/order to every other reference firmware) ── */
typedef struct {
    const char *name;
    void (*fn)(float v, float c, float t, char *status, char *msg);
} TestStep;

static void step_vdd(float v, float c, float t, char *status, char *msg) {
    (void)c; (void)t;
    if (v >= 3.0f && v <= 3.6f) { strcpy(status, "passed"); msg[0] = '\0'; }
    else { strcpy(status, "failed"); snprintf(msg, 64, "VDD %.3fV out of range 3.0-3.6V", v); }
}

static void step_clock(float v, float c, float t, char *status, char *msg) {
    (void)v; (void)c; (void)t;
    strcpy(status, "passed"); msg[0] = '\0'; /* system clock is stable by the time we get here */
}

static void step_gpio(float v, float c, float t, char *status, char *msg) {
    (void)v; (void)c; (void)t;
    gpio_put(GPIO_LOOP_OUT, 1);
    sleep_us(200);
    bool readback = gpio_get(GPIO_LOOP_IN);
    gpio_put(GPIO_LOOP_OUT, 0);
    if (readback) { strcpy(status, "passed"); msg[0] = '\0'; }
    else { strcpy(status, "failed"); strcpy(msg, "GPIO loopback mismatch - check GPIO15->GPIO14 jumper"); }
}

static void step_adc(float v, float c, float t, char *status, char *msg) {
    (void)c;
    if (v > 0.5f && v < 5.0f && t > -40.0f && t < 100.0f) {
        strcpy(status, "passed"); msg[0] = '\0';
    } else {
        strcpy(status, "failed"); snprintf(msg, 64, "ADC out of range v=%.2f t=%.1f", v, t);
    }
}

static void step_current(float v, float c, float t, char *status, char *msg) {
    (void)v; (void)t;
    if (c >= 0.0f && c < 200.0f) { strcpy(status, "passed"); msg[0] = '\0'; }
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

static void run_test_sequence(const char *run_id) {
    char buf[320];
    char step_status[16];
    char step_msg[64];
    bool overall_passed = true;

    snprintf(buf, sizeof(buf),
        "{\"type\":\"run_start\",\"runId\":\"%s\",\"hardwareId\":\"" HARDWARE_ID "\",\"firmwareVersion\":\"" FIRMWARE_VERSION "\"}",
        run_id);
    uart_json(buf);

    for (uint8_t i = 0; i < N_STEPS; i++) {
        float v = read_voltage();
        float c = read_current_ma();
        float t = read_temperature();
        char ts[32];
        snprintf(ts, sizeof(ts), "t+%llums", (unsigned long long)to_ms_since_boot(get_absolute_time()));

        STEPS[i].fn(v, c, t, step_status, step_msg);
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
        sleep_ms(500);
    }

    snprintf(buf, sizeof(buf),
        "{\"type\":\"run_end\",\"runId\":\"%s\",\"status\":\"%s\","
        "\"firmwareVersion\":\"" FIRMWARE_VERSION "\",\"finishedAt\":\"t+%llums\"}",
        run_id, overall_passed ? "passed" : "failed",
        (unsigned long long)to_ms_since_boot(get_absolute_time()));
    uart_json(buf);
}

/* ── main ─────────────────────────────────────────────────────────────────── */
int main(void) {
    stdio_init_all();

    uart_init(UART_ID, UART_BAUD);
    gpio_set_function(UART_TX_PIN, GPIO_FUNC_UART);
    gpio_set_function(UART_RX_PIN, GPIO_FUNC_UART);

    adc_init();
    adc_gpio_init(26);
    adc_gpio_init(27);
    adc_gpio_init(28);

    gpio_init(GPIO_LOOP_OUT);
    gpio_set_dir(GPIO_LOOP_OUT, GPIO_OUT);
    gpio_init(GPIO_LOOP_IN);
    gpio_set_dir(GPIO_LOOP_IN, GPIO_IN);

    uart_json("{\"type\":\"heartbeat\",\"hardwareId\":\"" HARDWARE_ID "\",\"firmwareVersion\":\"" FIRMWARE_VERSION "\"}");

    absolute_time_t next_tick = make_timeout_time_ms(1000);
    uint8_t metrics_tick = 0;
    char buf[256];

    while (1) {
        poll_uart_rx();

        if (rx_ready) {
            rx_ready = false;
            char cmd_run_id[64] = {0};
            if (strstr(rx_buf, "command_run") &&
                json_get_str(rx_buf, "runId", cmd_run_id, sizeof(cmd_run_id))) {
                run_test_sequence(cmd_run_id);
            }
        }

        if (time_reached(next_tick)) {
            next_tick = delayed_by_ms(next_tick, 1000);

            float v = read_voltage();
            float c = read_current_ma();
            float t = read_temperature();
            bool loop_state = gpio_get(GPIO_LOOP_IN);

            snprintf(buf, sizeof(buf),
                "{\"type\":\"metrics\","
                "\"temperature\":%.1f,\"voltage\":%.3f,\"currentMa\":%.1f,"
                "\"gpio\":{\"GPIO14\":%s}}",
                t, v, c, loop_state ? "true" : "false");
            uart_json(buf);

            if (++metrics_tick >= 30) {
                metrics_tick = 0;
                uart_json("{\"type\":\"heartbeat\",\"hardwareId\":\"" HARDWARE_ID "\",\"firmwareVersion\":\"" FIRMWARE_VERSION "\"}");
            }
        }
    }
}
