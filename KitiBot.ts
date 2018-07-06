
/**
 * 使用此文件来定义自定义函数和图形块。
 * 想了解更详细的信息，请前往 https://makecode.microbit.org/blocks/custom
 */

enum Motors {
    //% block="M1"
    M1 = 0x1,
    //% block="M2"
    M2 = 0x2,
}

enum Dir {
    //% block="Forward"
    forward = 0x1,
    //% block="Backward"
    backward = 0x2,
    //% block="TurnRight"
    turnRight = 0x3,
    //% block="TurnLeft"
    turnLeft = 0x4,
    //% block="stop"
    stop = 0x5,
}

/**
 * 自定义图形块
 */
//% weight=5 color=#0fbc11 icon="\uf113"
namespace KitiBot {
    const PCA9685_ADDRESS = 0x40
    const MODE1 = 0x00
    const MODE2 = 0x01
    const SUBADR1 = 0x02
    const SUBADR2 = 0x03
    const SUBADR3 = 0x04
    const PRESCALE = 0xFE
    const LED0_ON_L = 0x06
    const LED0_ON_H = 0x07
    const LED0_OFF_L = 0x08
    const LED0_OFF_H = 0x09
    const ALL_LED_ON_L = 0xFA
    const ALL_LED_ON_H = 0xFB
    const ALL_LED_OFF_L = 0xFC
    const ALL_LED_OFF_H = 0xFD

    const STP_CHA_L = 2047
    const STP_CHA_H = 4095

    const STP_CHB_L = 1
    const STP_CHB_H = 2047

    const STP_CHC_L = 1023
    const STP_CHC_H = 3071

    const STP_CHD_L = 3071
    const STP_CHD_H = 1023

    let initialized = false
    let last_value = 0; // assume initially that the line is left.
    let calibratedMax = [650, 650, 650, 650, 650];
    let calibratedMin = [100, 100, 100, 100, 100];

    function i2cwrite(addr: number, reg: number, value: number) {
        let buf = pins.createBuffer(2)
        buf[0] = reg
        buf[1] = value
        pins.i2cWriteBuffer(addr, buf)
    }

    function i2ccmd(addr: number, value: number) {
        let buf = pins.createBuffer(1)
        buf[0] = value
        pins.i2cWriteBuffer(addr, buf)
    }

    function i2cread(addr: number, reg: number) {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8BE);
        let val = pins.i2cReadNumber(addr, NumberFormat.UInt8BE);
        return val;
    }

    function initPCA9685(): void {
        i2cwrite(PCA9685_ADDRESS, MODE1, 0x00)
        setFreq(50);
        setPwm(0, 0, 4095);
        for (let idx = 1; idx < 16; idx++) {
            setPwm(idx, 0, 0);
        }
        initialized = true
    }

    function setFreq(freq: number): void {
        // Constrain the frequency
        let prescaleval = 25000000;
        prescaleval /= 4096;
        prescaleval /= freq;
        prescaleval -= 1;
        let prescale = prescaleval; //Math.Floor(prescaleval + 0.5);
        let oldmode = i2cread(PCA9685_ADDRESS, MODE1);
        let newmode = (oldmode & 0x7F) | 0x10; // sleep
        i2cwrite(PCA9685_ADDRESS, MODE1, newmode); // go to sleep
        i2cwrite(PCA9685_ADDRESS, PRESCALE, prescale); // set the prescaler
        i2cwrite(PCA9685_ADDRESS, MODE1, oldmode);
        control.waitMicros(5000);
        i2cwrite(PCA9685_ADDRESS, MODE1, oldmode | 0xa1);
    }

    function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15)
            return;

        let buf = pins.createBuffer(5);
        buf[0] = LED0_ON_L + 4 * channel;
        buf[1] = on & 0xff;
        buf[2] = (on >> 8) & 0xff;
        buf[3] = off & 0xff;
        buf[4] = (off >> 8) & 0xff;
        pins.i2cWriteBuffer(PCA9685_ADDRESS, buf);
    }

	/**
	 * Servo Execute
	 * @param degree [0-180] degree of servo; eg: 0, 90, 180
	*/
    //% blockId=kitibot_servo block="Servo channel|%channel|degree %degree"
	//% channel eg: 0
    //% degree eg：90
    //% weight=85
    //% degree.min=0 degree.max=180
    export function Servo(channel: number,degree: number): void {
		if (channel < 0 || channel > 15)
            return;
		if (!initialized) {
            initPCA9685()
        }
		// 50hz: 20,000 us
        let v_us = (degree * 1800 / 180 + 600) // 0.6 ~ 2.4
        let value = v_us * 4096 / 20000
        setPwm(channel, 0, value)
    }

    //% blockId=kitibot_motor_run block="Motor|%index|speed %speed"
    //% speed eg: 150
    //% weight=100
    //% speed.min=-255 speed.max=255
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function MotorRun(index: Motors, speed: number): void {
        if (!initialized) {
            initPCA9685()
        }
        speed = speed * 16; // map 255 to 4096
        if (speed >= 4096) {
            speed = 4095
        }
        if (speed <= -4096) {
            speed = -4095
        }
        if (index == 1) {
            if (speed >= 0) {
                setPwm(2, 0, 4095)
                setPwm(3, 0, 0)
                setPwm(1, 0, speed)
            } else {
                setPwm(2, 0, 0)
                setPwm(3, 0, 4095)
                setPwm(1, 0, -speed)
            }
        } else if (index == 2) {
            if (speed >= 0) {
                setPwm(5, 0, 4095)
                setPwm(4, 0, 0)
                setPwm(6, 0, speed)
            } else {
                setPwm(5, 0, 0)
                setPwm(4, 0, 4095)
                setPwm(6, 0, -speed)
            }
        }
    }
	/**
	 * Execute single motors 
	 * @param speed [-255-255] speed of motor; eg: 150
	*/
    //% blockId=kitibot_run block="|%index|speed %speed"
    //% speed eg: 150
    //% weight=95
    //% speed.min=-255 speed.max=255 eg: 150
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function Run(index: Dir, speed: number): void {
        switch (index) {
            case Dir.forward:
                MotorRun(Motors.M1, speed);
                MotorRun(Motors.M2, speed);
                break;
            case Dir.backward:
                MotorRun(Motors.M1, -speed);
                MotorRun(Motors.M2, -speed);
                break;
            case Dir.turnRight:
                MotorRun(Motors.M1, speed);
                MotorRun(Motors.M2, -speed);
                break;
            case Dir.turnLeft:
                MotorRun(Motors.M1, -speed);
                MotorRun(Motors.M2, speed);
                break;
            case Dir.stop:
                MotorRun(Motors.M1, 0);
                MotorRun(Motors.M2, 0);
                break;
        }
    }

	/**
	 * Execute single motors 
	 * @param speed [-255-255] speed of motor; eg: 150
	 * @param time dalay second time; eg: 2
	*/
    //% blockId=kitibot_run_delay block="|%index|speed %speed|for %time|sec"
    //% speed eg: 150
    //% weight=90
    //% speed.min=-255 speed.max=255 eg: 150
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function RunDelay(index: Dir, speed: number, time: number): void {
        Run(index, speed);
        basic.pause(time * 100);
        Run(Dir.stop, 0);
    }

    //% blockId=kitibot_ultrasonic block="Ultrasonic"
    //% weight=80
    export function Ultrasonic(): number {

        // send pulse
        pins.setPull(DigitalPin.P1, PinPullMode.PullNone);
        pins.digitalWritePin(DigitalPin.P1, 0);
        control.waitMicros(2);
        pins.digitalWritePin(DigitalPin.P1, 1);
        control.waitMicros(10);
        pins.digitalWritePin(DigitalPin.P1, 0);

        // read pulse
        let d = pins.pulseIn(DigitalPin.P2, PulseValue.High, 11600);
        return d / 58;
    }

    //% blockId=kitibot_AnalogRead block="AnalogRead"
    //% weight=80 advanced=true
    export function AnalogRead(): number[] {
        if (!initialized) {
            initPCA9685()
        }
        let i = 0;
        let j = 0;
        let channel = 0;
        let values = [0, 0, 0, 0, 0, 0];
        let sensor_values = [0, 0, 0, 0, 0];
        //pins.digitalWritePin(DigitalPin.P16, 0);
        setPwm(0, 0, 0);
        basic.pause(2);
        for (i = 0; i < 6; i++) {
            for (j = 0; j < 10; j++) {
                //0 to 4 clock transfer channel address
                if (j < 4) {
                    if ((i >> (3 - j)) & 0x01) {
                        pins.digitalWritePin(DigitalPin.P15, 1);
                    } else {
                        pins.digitalWritePin(DigitalPin.P15, 0);
                    }
                }
                //0 to 10 clock receives the previous conversion result
                values[i] <<= 1;
                if (pins.digitalReadPin(DigitalPin.P14)) {
                    values[i] |= 0x01;
                }
                pins.digitalWritePin(DigitalPin.P13, 1);
                pins.digitalWritePin(DigitalPin.P13, 0);
            }
        }
        //pins.digitalWritePin(DigitalPin.P16, 1);
        setPwm(0, 0, 4095);
        for (i = 0; i < 5; i++) {
            sensor_values[i] = values[i + 1];
        }
        return sensor_values;
    }

    //% blockId=kitibot_SensorCalibrated block="SensorCalibrated"
    //% weight=70 
    export function SensorCalibrated(): void {
        let i = 0;
        let j = 0;
        let k = 0;
        let max_sensor_values = [0, 0, 0, 0, 0];
        let min_sensor_values = [0, 0, 0, 0, 0];

        for (let i = 0; i < 5; i++)  // make the calibration take about 10 seconds
        {
            calibratedMax[i] = 0;
            calibratedMin[i] = 1023;
        }


        for (let i = 0; i < 100; i++)  // make the calibration take about 10 seconds
        {
            if (i < 25 || i >= 75) {
                Run(Dir.turnLeft, 100)
            }
            else {
                Run(Dir.turnRight, 100)
            }

            // reads all sensors 100 times
            for (j = 0; j < 5; j++) {
                let sensor_values = AnalogRead();
                for (k = 0; k < 5; k++) {
                    // set the max we found THIS time
                    if ((j == 0) || (max_sensor_values[k] < sensor_values[k]))
                        max_sensor_values[k] = sensor_values[k];

                    // set the min we found THIS time
                    if ((j == 0) || (min_sensor_values[k] > sensor_values[k]))
                        min_sensor_values[k] = sensor_values[k];
                }
            }

            // record the min and max calibration value
            for (k = 0; k < 5; k++) {
                if (min_sensor_values[k] > calibratedMax[k])
                    calibratedMax[k] = min_sensor_values[k];
                if (max_sensor_values[k] < calibratedMin[k])
                    calibratedMin[k] = max_sensor_values[k];
            }
        }

        Run(Dir.stop, 0);
    }
    //% blockId=kitibot_ReadSensorMax block="ReadSensorMax"
    //% weight=60 advanced=true
    export function ReadSensorMax(): number[] {
        return calibratedMax;
    }

    //% blockId=kitibot_ReadSensorMin block="ReadSensorMin"
    //% weight=50 advanced=true
    export function ReadSensorMin(): number[] {
        return calibratedMin;
    }

    // Returns values calibrated to a value between 0 and 1000, where
    // 0 corresponds to the minimum value read by calibrate() and 1000
    // corresponds to the maximum value.  Calibration values are
    // stored separately for each sensor, so that differences in the
    // sensors are accounted for automatically.
    //% blockId=kitibot_ReadCalibrated block="ReadCalibrated"
    //% weight=70 advanced=true
    export function readCalibrated(): number[] {
        // read the needed values
        let sensor_values = AnalogRead();

        for (let i = 0; i < 5; i++) {
            let denominator = calibratedMax[i] - calibratedMin[i];
            let x = ((sensor_values[i] - calibratedMin[i]) * 1000 / denominator);
            if (x < 0)
                x = 0;
            else if (x > 1000)
                x = 1000;
            sensor_values[i] = x;
        }
        return sensor_values;
    }

    //% blockId=kitibot_readLine block="ReadLine"
    //% weight=10
    export function readLine(): number {

        let i = 0;
        let on_line = 0;
        let avg = 0; // this is for the weighted total, which is long
        // before division
        let sum = 0; // this is for the denominator which is <= 64000
        let white_line = 0;

        // readCalibrated(sensor_values);
        let sensor_values = readCalibrated();

        for (i = 0; i < 5; i++) {
            let value = sensor_values[i];

            if (!white_line)
                value = 1000 - value;
            sensor_values[i] = value;
            // keep track of whether we see the line at all
            if (value > 200) {
                on_line = 1;
            }

            // only average in values that are above a noise threshold
            if (value > 50) {
                avg += (value) * (i * 1000);
                sum += value;
            }
        }

        if (!on_line) {
            // If it last read to the left of center, return 0.
            if (last_value < (4) * 1000 / 2)
                return 0;
            // If it last read to the right of center, return the max.
            else
                return 4 * 1000;
        }

        last_value = avg / sum;

        return last_value;
    }
} 
