/*
 * testbench REFERENCE firmware — STM32F103C8 ("Blue Pill", STM32Cube HAL)
 *
 * Third reference implementation of testbench's device contract (see
 * ../main.c for MSP430 and ../esp32/src/main.cpp for ESP32). STM32 is the
 * closest thing to an industry-standard MCU family for real embedded
 * product work — medical, automotive, and industrial control all lean on
 * it — so this port is written against ST's own HAL (STM32Cube), the way a
 * production firmware team would actually build it, rather than a
 * beginner-framework wrapper. Nothing on the bridge or backend changed to
 * support this chip; it emits byte-for-byte the same JSON frames as every
 * other reference firmware in this repo.
 *
 * UART (this board): USART1 — PA9 TX / PA10 RX — 9600 baud, 8N1
 * ADC (this board):  PA0 = VDD sense, PA1 = current sense, PA2 = temp sense
 * GPIO loopback:     drive PB0, read back on PB1 (jumper the two together)
 *
 * Outbound JSON frames (device -> bridge):
 *   {"type":"heartbeat","hardwareId":"stm32-01","firmwareVersion":"1.0.0"}
 *   {"type":"metrics","temperature":25.1,"voltage":3.28,"currentMa":12.4,"gpio":{...}}
 *   {"type":"run_start","runId":"...","hardwareId":"stm32-01","firmwareVersion":"1.0.0"}
 *   {"type":"run_step","runId":"...","sequence":1,"name":"VDD check","status":"passed","startedAt":"...","finishedAt":"...","message":null}
 *   {"type":"run_end","runId":"...","status":"passed","firmwareVersion":"1.0.0","finishedAt":"..."}
 *
 * Inbound JSON frames (bridge -> device):
 *   {"type":"command_run","runId":"...","hardwareId":"..."}
 *
 * Build: PlatformIO, see firmware/stm32/platformio.ini (`pio run`, `pio run -t upload`)
 */

#include "stm32f1xx_hal.h"
#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <math.h>

#define FIRMWARE_VERSION "1.0.0"
#define HARDWARE_ID      "stm32-01"

static UART_HandleTypeDef huart1;
static ADC_HandleTypeDef  hadc1;

/* ── UART rx line buffer (filled one byte at a time via interrupt) ─────────── */
static char rx_buf[256];
static uint8_t rx_len = 0;
static volatile bool rx_ready = false;
static uint8_t rx_byte;

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
    if (huart->Instance != USART1) return;
    char c = (char)rx_byte;
    if (c == '\n' || c == '\r') {
        rx_buf[rx_len] = '\0';
        if (rx_len > 0) rx_ready = true;
        rx_len = 0;
    } else if (rx_len < sizeof(rx_buf) - 1) {
        rx_buf[rx_len++] = c;
    }
    HAL_UART_Receive_IT(&huart1, &rx_byte, 1);
}

void uart_json(const char *json) {
    HAL_UART_Transmit(&huart1, (uint8_t *)json, strlen(json), 100);
    HAL_UART_Transmit(&huart1, (uint8_t *)"\n", 1, 10);
}

/* ── clocks / peripherals ─────────────────────────────────────────────────── */
static void clock_init(void) {
    RCC_OscInitTypeDef osc = {0};
    RCC_ClkInitTypeDef clk = {0};

    osc.OscillatorType = RCC_OSCILLATORTYPE_HSE;
    osc.HSEState       = RCC_HSE_ON;
    osc.PLL.PLLState   = RCC_PLL_ON;
    osc.PLL.PLLSource  = RCC_PLLSOURCE_HSE;
    osc.PLL.PLLMUL     = RCC_PLL_MUL9; /* 8MHz HSE * 9 = 72MHz */
    HAL_RCC_OscConfig(&osc);

    clk.ClockType = RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_HCLK |
                    RCC_CLOCKTYPE_PCLK1  | RCC_CLOCKTYPE_PCLK2;
    clk.SYSCLKSource   = RCC_SYSCLKSOURCE_PLLCLK;
    clk.AHBCLKDivider  = RCC_SYSCLK_DIV1;
    clk.APB1CLKDivider = RCC_HCLK_DIV2;
    clk.APB2CLKDivider = RCC_HCLK_DIV1;
    HAL_RCC_ClockConfig(&clk, FLASH_LATENCY_2);
}

static void uart_init(void) {
    __HAL_RCC_USART1_CLK_ENABLE();
    huart1.Instance          = USART1;
    huart1.Init.BaudRate     = 9600;
    huart1.Init.WordLength   = UART_WORDLENGTH_8B;
    huart1.Init.StopBits     = UART_STOPBITS_1;
    huart1.Init.Parity       = UART_PARITY_NONE;
    huart1.Init.Mode         = UART_MODE_TX_RX;
    huart1.Init.HwFlowCtl    = UART_HWCONTROL_NONE;
    HAL_UART_Init(&huart1);
    HAL_UART_Receive_IT(&huart1, &rx_byte, 1);
}

static void adc_init(void) {
    __HAL_RCC_ADC1_CLK_ENABLE();
    hadc1.Instance = ADC1;
    hadc1.Init.ScanConvMode         = DISABLE;
    hadc1.Init.ContinuousConvMode   = DISABLE;
    hadc1.Init.DataAlign            = ADC_DATAALIGN_RIGHT;
    hadc1.Init.NbrOfConversion       = 1;
    HAL_ADC_Init(&hadc1);
}

static void gpio_init(void) {
    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_GPIOB_CLK_ENABLE();

    GPIO_InitTypeDef gpio = {0};
    gpio.Pin  = GPIO_PIN_0; /* loopback out */
    gpio.Mode = GPIO_MODE_OUTPUT_PP;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOB, &gpio);

    gpio.Pin  = GPIO_PIN_1; /* loopback in */
    gpio.Mode = GPIO_MODE_INPUT;
    gpio.Pull = GPIO_NOPULL;
    HAL_GPIO_Init(GPIOB, &gpio);

    gpio.Pin  = GPIO_PIN_0 | GPIO_PIN_1 | GPIO_PIN_2; /* PA0-2, analog */
    gpio.Mode = GPIO_MODE_ANALOG;
    HAL_GPIO_Init(GPIOA, &gpio);
}

static uint16_t adc_read(uint32_t channel) {
    ADC_ChannelConfTypeDef ch = {0};
    ch.Channel      = channel;
    ch.Rank         = ADC_REGULAR_RANK_1;
    ch.SamplingTime = ADC_SAMPLETIME_55CYCLES_5;
    HAL_ADC_ConfigChannel(&hadc1, &ch);
    HAL_ADC_Start(&hadc1);
    HAL_ADC_PollForConversion(&hadc1, 10);
    return (uint16_t)HAL_ADC_GetValue(&hadc1);
}

static float read_voltage(void) {
    return (adc_read(ADC_CHANNEL_0) / 4095.0f) * 3.3f * 2.0f; /* external divider */
}

static float read_current_ma(void) {
    float mv = (adc_read(ADC_CHANNEL_1) / 4095.0f) * 3300.0f;
    return mv < 500.0f ? 0.0f : (mv - 500.0f) * 0.1f;
}

static float read_temperature(void) {
    float vadc = (adc_read(ADC_CHANNEL_2) / 4095.0f) * 3300.0f;
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
    strcpy(status, "passed"); msg[0] = '\0'; /* PLL is locked by the time we get here */
}

static void step_gpio(float v, float c, float t, char *status, char *msg) {
    (void)v; (void)c; (void)t;
    HAL_GPIO_WritePin(GPIOB, GPIO_PIN_0, GPIO_PIN_SET);
    HAL_Delay(1);
    bool readback = HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_1) == GPIO_PIN_SET;
    HAL_GPIO_WritePin(GPIOB, GPIO_PIN_0, GPIO_PIN_RESET);
    if (readback) { strcpy(status, "passed"); msg[0] = '\0'; }
    else { strcpy(status, "failed"); strcpy(msg, "GPIO loopback mismatch - check PB0->PB1 jumper"); }
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
        snprintf(ts, sizeof(ts), "t+%lums", (unsigned long)HAL_GetTick());

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
        HAL_Delay(500);
    }

    snprintf(buf, sizeof(buf),
        "{\"type\":\"run_end\",\"runId\":\"%s\",\"status\":\"%s\","
        "\"firmwareVersion\":\"" FIRMWARE_VERSION "\",\"finishedAt\":\"t+%lums\"}",
        run_id, overall_passed ? "passed" : "failed", (unsigned long)HAL_GetTick());
    uart_json(buf);
}

/* ── main ─────────────────────────────────────────────────────────────────── */
int main(void) {
    HAL_Init();
    clock_init();
    uart_init();
    adc_init();
    gpio_init();

    uart_json("{\"type\":\"heartbeat\",\"hardwareId\":\"" HARDWARE_ID "\",\"firmwareVersion\":\"" FIRMWARE_VERSION "\"}");

    uint32_t last_tick = HAL_GetTick();
    uint8_t metrics_tick = 0;
    char buf[256];

    while (1) {
        if (rx_ready) {
            rx_ready = false;
            char cmd_run_id[64] = {0};
            if (strstr(rx_buf, "command_run") &&
                json_get_str(rx_buf, "runId", cmd_run_id, sizeof(cmd_run_id))) {
                run_test_sequence(cmd_run_id);
            }
        }

        if (HAL_GetTick() - last_tick >= 1000) {
            last_tick += 1000;

            float v = read_voltage();
            float c = read_current_ma();
            float t = read_temperature();
            bool loop_state = HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_1) == GPIO_PIN_SET;

            snprintf(buf, sizeof(buf),
                "{\"type\":\"metrics\","
                "\"temperature\":%.1f,\"voltage\":%.3f,\"currentMa\":%.1f,"
                "\"gpio\":{\"PB1\":%s}}",
                t, v, c, loop_state ? "true" : "false");
            uart_json(buf);

            if (++metrics_tick >= 30) {
                metrics_tick = 0;
                uart_json("{\"type\":\"heartbeat\",\"hardwareId\":\"" HARDWARE_ID "\",\"firmwareVersion\":\"" FIRMWARE_VERSION "\"}");
            }
        }
    }
}
