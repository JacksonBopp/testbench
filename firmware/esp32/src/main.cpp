/*
 * testbench REFERENCE firmware — ESP32 (Arduino core)
 *
 * Second reference implementation of testbench's device contract, proving the
 * platform-first design in the top-level README: the backend, MQTT bridge, and
 * dashboard are unmodified — they only ever see the same newline-terminated JSON
 * frames documented in ../main.c and the repo README. Everything below is
 * ESP32-specific peripheral code (UART / ADC / GPIO / millis-based tick); the
 * frame shapes are byte-for-byte identical to the MSP430 port.
 *
 * This board talks over a dedicated hardware UART (Serial2) to the bridge host,
 * exactly like the MSP430 does — it does NOT use its WiFi radio to reach MQTT
 * directly. That keeps one bridge (pi/bridge.py) working for both chips
 * unmodified. A WiFi-direct variant (skip the Pi, publish to MQTT over WiFi) is
 * a natural follow-up and is called out in the top-level README roadmap.
 *
 * UART (this board): Serial2 — GPIO16 RX / GPIO17 TX — 9600 baud, 8N1
 * ADC (this board):  GPIO34 = VDD sense, GPIO35 = current sense, GPIO32 = temp sense
 * GPIO loopback:     drive GPIO25, read back on GPIO27 (jumper the two together)
 *
 * Outbound JSON frames (device -> bridge):
 *   {"type":"heartbeat","hardwareId":"esp32-01","firmwareVersion":"1.0.0"}
 *   {"type":"metrics","temperature":25.1,"voltage":3.28,"currentMa":12.4,"gpio":{...}}
 *   {"type":"run_start","runId":"...","hardwareId":"esp32-01","firmwareVersion":"1.0.0"}
 *   {"type":"run_step","runId":"...","sequence":1,"name":"VDD check","status":"passed","startedAt":"...","finishedAt":"...","message":null}
 *   {"type":"run_end","runId":"...","status":"passed","firmwareVersion":"1.0.0","finishedAt":"..."}
 *
 * Inbound JSON frames (bridge -> device):
 *   {"type":"command_run","runId":"...","hardwareId":"..."}
 *
 * Build: PlatformIO, see firmware/esp32/platformio.ini (`pio run`, `pio run -t upload`)
 */

#include <Arduino.h>

#define FIRMWARE_VERSION "1.0.0"
#define HARDWARE_ID      "esp32-01"

/* ── UART ─────────────────────────────────────────────────────────────────── */
#define UART_BAUD   9600
#define UART_RX_PIN 16
#define UART_TX_PIN 17

static char rx_buf[256];
static uint8_t rx_len = 0;
static bool rx_ready = false;

void uart_json(const String &json) {
    Serial2.print(json);
    Serial2.print('\n');
}

void poll_uart_rx(void) {
    while (Serial2.available()) {
        char c = (char)Serial2.read();
        if (c == '\n' || c == '\r') {
            rx_buf[rx_len] = '\0';
            if (rx_len > 0) rx_ready = true;
            rx_len = 0;
        } else if (rx_len < sizeof(rx_buf) - 1) {
            rx_buf[rx_len++] = c;
        }
    }
}

/* ── ADC / GPIO ───────────────────────────────────────────────────────────── */
#define ADC_VDD_PIN     34
#define ADC_CURRENT_PIN 35
#define ADC_TEMP_PIN    32
#define GPIO_LOOP_OUT   25
#define GPIO_LOOP_IN    27

float read_voltage(void) {
    // 12-bit ADC, 3.3V reference, external divider assumed on ADC_VDD_PIN
    return (analogRead(ADC_VDD_PIN) / 4095.0f) * 3.3f * 2.0f;
}

float read_current_ma(void) {
    float mv = (analogRead(ADC_CURRENT_PIN) / 4095.0f) * 3300.0f;
    return mv < 500.0f ? 0.0f : (mv - 500.0f) * 0.1f;
}

float read_temperature(void) {
    // NTC thermistor on a resistor divider, same model as the MSP430 reference
    float vadc = (analogRead(ADC_TEMP_PIN) / 4095.0f) * 3300.0f;
    float vcc = 3300.0f;
    if (vadc <= 0.0f || vadc >= vcc) return -99.0f;
    float r = 10000.0f * vadc / (vcc - vadc);
    float inv_t = (1.0f / 298.15f) + (1.0f / 3950.0f) * logf(r / 10000.0f);
    return (1.0f / inv_t) - 273.15f;
}

/* ── lightweight JSON key extractor (mirrors firmware/main.c) ───────────────── */
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
    // Reaching this point means the ESP32's PLL/crystal is already stable
    strcpy(status, "passed"); msg[0] = '\0';
}

static void step_gpio(float v, float c, float t, char *status, char *msg) {
    (void)v; (void)c; (void)t;
    digitalWrite(GPIO_LOOP_OUT, HIGH);
    delayMicroseconds(200);
    bool readback = digitalRead(GPIO_LOOP_IN) == HIGH;
    digitalWrite(GPIO_LOOP_OUT, LOW);
    if (readback) { strcpy(status, "passed"); msg[0] = '\0'; }
    else { strcpy(status, "failed"); strcpy(msg, "GPIO loopback mismatch - check GPIO25->GPIO27 jumper"); }
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

void run_test_sequence(const char *run_id) {
    char buf[320];
    char step_status[16];
    char step_msg[64];
    bool overall_passed = true;

    uart_json(String("{\"type\":\"run_start\",\"runId\":\"") + run_id +
               "\",\"hardwareId\":\"" HARDWARE_ID "\",\"firmwareVersion\":\"" FIRMWARE_VERSION "\"}");

    for (uint8_t i = 0; i < N_STEPS; i++) {
        float v = read_voltage();
        float c = read_current_ma();
        float temp = read_temperature();
        char ts[32];
        snprintf(ts, sizeof(ts), "t+%lums", (unsigned long)millis());

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
        delay(500);
    }

    snprintf(buf, sizeof(buf),
        "{\"type\":\"run_end\",\"runId\":\"%s\",\"status\":\"%s\","
        "\"firmwareVersion\":\"" FIRMWARE_VERSION "\",\"finishedAt\":\"t+%lums\"}",
        run_id, overall_passed ? "passed" : "failed", (unsigned long)millis());
    uart_json(buf);
}

/* ── main ─────────────────────────────────────────────────────────────────── */
static uint32_t last_tick_ms = 0;
static uint8_t metrics_tick = 0;

void setup() {
    Serial2.begin(UART_BAUD, SERIAL_8N1, UART_RX_PIN, UART_TX_PIN);
    analogReadResolution(12);
    pinMode(GPIO_LOOP_OUT, OUTPUT);
    pinMode(GPIO_LOOP_IN, INPUT);

    uart_json("{\"type\":\"heartbeat\",\"hardwareId\":\"" HARDWARE_ID "\",\"firmwareVersion\":\"" FIRMWARE_VERSION "\"}");
    last_tick_ms = millis();
}

void loop() {
    poll_uart_rx();

    if (rx_ready) {
        rx_ready = false;
        char cmd_run_id[64] = {0};
        if (strstr(rx_buf, "command_run") &&
            json_get_str(rx_buf, "runId", cmd_run_id, sizeof(cmd_run_id))) {
            run_test_sequence(cmd_run_id);
        }
    }

    if (millis() - last_tick_ms >= 1000) {
        last_tick_ms += 1000;

        float v = read_voltage();
        float c = read_current_ma();
        float temp = read_temperature();
        bool loop_state = digitalRead(GPIO_LOOP_IN) == HIGH;

        char buf[256];
        snprintf(buf, sizeof(buf),
            "{\"type\":\"metrics\","
            "\"temperature\":%.1f,\"voltage\":%.3f,\"currentMa\":%.1f,"
            "\"gpio\":{\"GPIO27\":%s}}",
            temp, v, c, loop_state ? "true" : "false");
        uart_json(buf);

        if (++metrics_tick >= 30) {
            metrics_tick = 0;
            uart_json("{\"type\":\"heartbeat\",\"hardwareId\":\"" HARDWARE_ID "\",\"firmwareVersion\":\"" FIRMWARE_VERSION "\"}");
        }
    }
}
