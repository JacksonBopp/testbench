# testbench RP2040 reference firmware
# Requires the Raspberry Pi Pico SDK (https://github.com/raspberrypi/pico-sdk).
# Build:
#   export PICO_SDK_PATH=/path/to/pico-sdk
#   mkdir build && cd build
#   cmake .. -DPICO_BOARD=pico
#   make -j4
# Flash by copying build/testbench_rp2040.uf2 to the Pico's USB mass-storage
# drive while holding BOOTSEL.

cmake_minimum_required(VERSION 3.13)

include($ENV{PICO_SDK_PATH}/pico_sdk_init.cmake)

project(testbench_rp2040 C CXX ASM)
set(CMAKE_C_STANDARD 11)

pico_sdk_init()

add_executable(testbench_rp2040 src/main.c)

target_link_libraries(testbench_rp2040
    pico_stdlib
    hardware_uart
    hardware_adc
    hardware_gpio
)

pico_add_extra_outputs(testbench_rp2040)
