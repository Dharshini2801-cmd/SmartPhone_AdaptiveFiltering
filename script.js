/* =====================================================
   SIGNAL PROCESSING WITH SMARTPHONE
   Adaptive Voice Lab
   FFT Spectral Noise Reduction
===================================================== */


// =====================================================
// ELEMENTS
// =====================================================

const recordButton =
    document.getElementById("recordButton");

const recordText =
    document.getElementById("recordText");

const recordIcon =
    document.getElementById("recordIcon");

const micIndicator =
    document.getElementById("micIndicator");

const recordStatus =
    document.getElementById("recordStatus");

const timer =
    document.getElementById("timer");

const permissionText =
    document.getElementById("permissionText");

const originalSection =
    document.getElementById("originalSection");

const originalAudio =
    document.getElementById("originalAudio");

const processButton =
    document.getElementById("processButton");

const processingBox =
    document.getElementById("processingBox");

const resultSection =
    document.getElementById("resultSection");

const processedAudio =
    document.getElementById("processedAudio");

const strengthSlider =
    document.getElementById("strengthSlider");

const strengthValue =
    document.getElementById("strengthValue");

const meterFill =
    document.getElementById("meterFill");

const resultText =
    document.getElementById("resultText");


// =====================================================
// STATE
// =====================================================

let mediaRecorder = null;

let microphoneStream = null;

let chunks = [];

let recordingBlob = null;

let recording = false;

let seconds = 0;

let timerInterval = null;


// =====================================================
// SLIDER
// =====================================================

strengthSlider.addEventListener(
    "input",
    function () {

        strengthValue.textContent =
            strengthSlider.value + "%";

    }
);


// =====================================================
// RECORD
// =====================================================

recordButton.addEventListener(
    "click",
    async function () {

        if (recording) {

            stopRecording();

        } else {

            await startRecording();

        }

    }
);


// =====================================================
// START RECORDING
// =====================================================

async function startRecording() {

    try {

        microphoneStream =
            await navigator.mediaDevices.getUserMedia({

                audio: {

                    echoCancellation: false,

                    noiseSuppression: false,

                    autoGainControl: false

                }

            });


        chunks = [];


        let options = {};


        if (
            MediaRecorder.isTypeSupported(
                "audio/webm;codecs=opus"
            )
        ) {

            options.mimeType =
                "audio/webm;codecs=opus";

        }


        mediaRecorder =
            new MediaRecorder(
                microphoneStream,
                options
            );


        mediaRecorder.ondataavailable =
            function (event) {

                if (event.data.size > 0) {

                    chunks.push(
                        event.data
                    );

                }

            };


        mediaRecorder.onstop =
            finishRecording;


        mediaRecorder.start();


        recording = true;

        seconds = 0;


        timerInterval =
            setInterval(
                updateTimer,
                1000
            );


        micIndicator.classList.add(
            "recording"
        );


        recordButton.classList.add(
            "recording-button"
        );


        recordIcon.textContent =
            "■";


        recordText.textContent =
            "Stop Recording";


        recordStatus.textContent =
            "Recording...";


        permissionText.textContent =
            "Stay silent for about 2 seconds, then speak normally.";


    }

    catch (error) {

        console.error(error);


        alert(
            "Microphone access is required.\n\n" +
            error.message
        );

    }

}


// =====================================================
// STOP
// =====================================================

function stopRecording() {

    if (
        mediaRecorder &&
        mediaRecorder.state === "recording"
    ) {

        mediaRecorder.stop();

    }


    recording = false;


    clearInterval(
        timerInterval
    );


    micIndicator.classList.remove(
        "recording"
    );


    recordButton.classList.remove(
        "recording-button"
    );


    recordIcon.textContent =
        "●";


    recordText.textContent =
        "Start Recording";


    recordStatus.textContent =
        "Preparing recording...";

}


// =====================================================
// FINISH
// =====================================================

function finishRecording() {

    recordingBlob =
        new Blob(
            chunks,
            {
                type:
                    mediaRecorder.mimeType ||
                    "audio/webm"
            }
        );


    const url =
        URL.createObjectURL(
            recordingBlob
        );


    originalAudio.src =
        url;


    originalSection.classList.remove(
        "hidden"
    );


    processButton.disabled =
        false;


    recordStatus.textContent =
        "Recording ready ✓";


    permissionText.textContent =
        "Listen to the original signal or process it below.";


    if (microphoneStream) {

        microphoneStream
            .getTracks()
            .forEach(
                track => track.stop()
            );

    }

}


// =====================================================
// TIMER
// =====================================================

function updateTimer() {

    seconds++;


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainingSeconds =
        seconds % 60;


    timer.textContent =
        String(minutes).padStart(
            2,
            "0"
        )
        +
        ":"
        +
        String(remainingSeconds).padStart(
            2,
            "0"
        );

}


// =====================================================
// PROCESS
// =====================================================

processButton.addEventListener(
    "click",
    async function () {

        if (!recordingBlob) {

            alert(
                "Please record your audio first."
            );

            return;

        }


        processButton.disabled =
            true;


        processingBox.classList.remove(
            "hidden"
        );


        resultSection.classList.add(
            "hidden"
        );


        try {

            const processed =
                await processAudio(
                    recordingBlob
                );


            processedAudio.src =
                URL.createObjectURL(
                    processed
                );


            resultSection.classList.remove(
                "hidden"
            );


            animateMeter();


        }

        catch (error) {

            console.error(error);


            alert(
                "Processing failed.\n\n" +
                error.message
            );

        }


        processingBox.classList.add(
            "hidden"
        );


        processButton.disabled =
            false;

    }
);


// =====================================================
// PROCESS AUDIO
// =====================================================

async function processAudio(blob) {

    const arrayBuffer =
        await blob.arrayBuffer();


    const audioContext =
        new AudioContext();


    const audioBuffer =
        await audioContext.decodeAudioData(
            arrayBuffer
        );


    const input =
        mono(
            audioBuffer
        );


    const sampleRate =
        audioBuffer.sampleRate;


    /*
       First 2 seconds are assumed to contain
       mostly background noise.
    */

    const noiseLength =
        Math.min(
            Math.floor(
                sampleRate * 2
            ),
            input.length
        );


    const strength =
        Number(
            strengthSlider.value
        ) / 100;


    const output =
        spectralSubtraction(
            input,
            sampleRate,
            noiseLength,
            strength
        );


    const wav =
        makeWav(
            output,
            sampleRate
        );


    await audioContext.close();


    return wav;

}


// =====================================================
// MONO
// =====================================================

function mono(buffer) {

    const channels =
        buffer.numberOfChannels;


    const length =
        buffer.length;


    const output =
        new Float32Array(
            length
        );


    for (
        let channel = 0;
        channel < channels;
        channel++
    ) {

        const data =
            buffer.getChannelData(
                channel
            );


        for (
            let i = 0;
            i < length;
            i++
        ) {

            output[i] +=
                data[i] / channels;

        }

    }


    return output;

}


// =====================================================
// SPECTRAL SUBTRACTION
// =====================================================

function spectralSubtraction(
    input,
    sampleRate,
    noiseLength,
    strength
) {

    /*
       1024-point FFT gives good balance
       between frequency resolution and
       processing speed.
    */

    const N = 1024;

    const hop = 512;


    const output =
        new Float32Array(
            input.length
        );


    const window =
        hannWindow(N);


    /*
       Estimate average noise spectrum.
    */

    const noiseSpectrum =
        estimateNoiseSpectrum(
            input,
            noiseLength,
            N,
            hop,
            window
        );


    /*
       Process each frame.
    */

    for (
        let start = 0;
        start < input.length;
        start += hop
    ) {

        const real =
            new Float64Array(N);

        const imag =
            new Float64Array(N);


        for (
            let i = 0;
            i < N;
            i++
        ) {

            const index =
                start + i;


            if (
                index < input.length
            ) {

                real[i] =
                    input[index] *
                    window[i];

            } else {

                real[i] = 0;

            }

        }


        fft(
            real,
            imag
        );


        /*
           Magnitude + phase.
        */

        for (
            let k = 0;
            k < N;
            k++
        ) {

            const magnitude =
                Math.sqrt(
                    real[k] * real[k] +
                    imag[k] * imag[k]
                );


            const phase =
                Math.atan2(
                    imag[k],
                    real[k]
                );


            /*
               Spectral subtraction.

               Over-subtraction factor
               increases with strength.
            */

            const alpha =
                1.0 +
                strength * 3.0;


            let cleanMagnitude =
                magnitude -
                alpha *
                noiseSpectrum[k];


            /*
               Spectral floor prevents
               musical-noise artifacts.
            */

            const floor =
                magnitude *
                (0.05 + (1 - strength) * 0.10);


            cleanMagnitude =
                Math.max(
                    cleanMagnitude,
                    floor
                );


            real[k] =
                cleanMagnitude *
                Math.cos(phase);


            imag[k] =
                cleanMagnitude *
                Math.sin(phase);

        }


        /*
           Inverse FFT.
        */

        inverseFFT(
            real,
            imag
        );


        /*
           Overlap-add.
        */

        for (
            let i = 0;
            i < N;
            i++
        ) {

            const index =
                start + i;


            if (
                index < output.length
            ) {

                output[index] +=
                    real[i] *
                    window[i];

            }

        }

    }


    /*
       Normalize after processing.
    */

    return normalize(
        output
    );

}


// =====================================================
// NOISE SPECTRUM
// =====================================================

function estimateNoiseSpectrum(
    input,
    noiseLength,
    N,
    hop,
    window
) {

    const spectrum =
        new Float64Array(N);


    let frames = 0;


    for (
        let start = 0;
        start + N <= noiseLength;
        start += hop
    ) {

        const real =
            new Float64Array(N);

        const imag =
            new Float64Array(N);


        for (
            let i = 0;
            i < N;
            i++
        ) {

            real[i] =
                input[start + i] *
                window[i];

        }


        fft(
            real,
            imag
        );


        for (
            let k = 0;
            k < N;
            k++
        ) {

            spectrum[k] +=
                Math.sqrt(
                    real[k] * real[k] +
                    imag[k] * imag[k]
                );

        }


        frames++;

    }


    if (
        frames === 0
    ) {

        return spectrum;

    }


    for (
        let k = 0;
        k < N;
        k++
    ) {

        spectrum[k] /=
            frames;

    }


    return spectrum;

}


// =====================================================
// HANN WINDOW
// =====================================================

function hannWindow(N) {

    const window =
        new Float64Array(N);


    for (
        let i = 0;
        i < N;
        i++
    ) {

        window[i] =
            0.5 *
            (
                1 -
                Math.cos(
                    2 *
                    Math.PI *
                    i /
                    (N - 1)
                )
            );

    }


    return window;

}


// =====================================================
// FFT
// =====================================================

function fft(real, imag) {

    const N =
        real.length;


    /*
       Bit reversal.
    */

    let j = 0;


    for (
        let i = 1;
        i < N;
        i++
    ) {

        let bit =
            N >> 1;


        while (
            j & bit
        ) {

            j ^=
                bit;

            bit >>=
                1;

        }


        j ^=
            bit;


        if (
            i < j
        ) {

            [
                real[i],
                real[j]
            ] =
            [
                real[j],
                real[i]
            ];


            [
                imag[i],
                imag[j]
            ] =
            [
                imag[j],
                imag[i]
            ];

        }

    }


    /*
       Cooley-Tukey FFT.
    */

    for (
        let length = 2;
        length <= N;
        length <<= 1
    ) {

        const angle =
            -2 *
            Math.PI /
            length;


        const wReal =
            Math.cos(angle);


        const wImag =
            Math.sin(angle);


        for (
            let i = 0;
            i < N;
            i += length
        ) {

            let currentReal = 1;

            let currentImag = 0;


            const half =
                length >> 1;


            for (
                let j = 0;
                j < half;
                j++
            ) {

                const even =
                    i + j;


                const odd =
                    even + half;


                const tempReal =
                    currentReal *
                    real[odd]
                    -
                    currentImag *
                    imag[odd];


                const tempImag =
                    currentReal *
                    imag[odd]
                    +
                    currentImag *
                    real[odd];


                real[odd] =
                    real[even] -
                    tempReal;


                imag[odd] =
                    imag[even] -
                    tempImag;


                real[even] +=
                    tempReal;


                imag[even] +=
                    tempImag;


                const nextReal =
                    currentReal *
                    wReal
                    -
                    currentImag *
                    wImag;


                const nextImag =
                    currentReal *
                    wImag
                    +
                    currentImag *
                    wReal;


                currentReal =
                    nextReal;


                currentImag =
                    nextImag;

            }

        }

    }

}


// =====================================================
// INVERSE FFT
// =====================================================

function inverseFFT(
    real,
    imag
) {

    const N =
        real.length;


    /*
       Conjugate.
    */

    for (
        let i = 0;
        i < N;
        i++
    ) {

        imag[i] =
            -imag[i];

    }


    fft(
        real,
        imag
    );


    /*
       Conjugate + normalize.
    */

    for (
        let i = 0;
        i < N;
        i++
    ) {

        real[i] /=
            N;

        imag[i] =
            -imag[i] / N;

    }

}


// =====================================================
// NORMALIZE
// =====================================================

function normalize(data) {

    let max =
        0;


    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        max =
            Math.max(
                max,
                Math.abs(
                    data[i]
                )
            );

    }


    if (
        max === 0
    ) {

        return data;

    }


    const scale =
        Math.min(
            1,
            0.95 / max
        );


    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        data[i] *=
            scale;

    }


    return data;

}


// =====================================================
// WAV
// =====================================================

function makeWav(
    samples,
    sampleRate
) {

    const buffer =
        new ArrayBuffer(
            44 +
            samples.length * 2
        );


    const view =
        new DataView(
            buffer
        );


    writeString(
        view,
        0,
        "RIFF"
    );


    view.setUint32(
        4,
        36 +
        samples.length * 2,
        true
    );


    writeString(
        view,
        8,
        "WAVE"
    );


    writeString(
        view,
        12,
        "fmt "
    );


    view.setUint32(
        16,
        16,
        true
    );


    view.setUint16(
        20,
        1,
        true
    );


    view.setUint16(
        22,
        1,
        true
    );


    view.setUint32(
        24,
        sampleRate,
        true
    );


    view.setUint32(
        28,
        sampleRate * 2,
        true
    );


    view.setUint16(
        32,
        2,
        true
    );


    view.setUint16(
        34,
        16,
        true
    );


    writeString(
        view,
        36,
        "data"
    );


    view.setUint32(
        40,
        samples.length * 2,
        true
    );


    let offset =
        44;


    for (
        let i = 0;
        i < samples.length;
        i++
    ) {

        let sample =
            Math.max(
                -1,
                Math.min(
                    1,
                    samples[i]
                )
            );


        const value =
            sample < 0
                ? sample * 32768
                : sample * 32767;


        view.setInt16(
            offset,
            value,
            true
        );


        offset +=
            2;

    }


    return new Blob(
        [view],
        {
            type:
                "audio/wav"
        }
    );

}


// =====================================================
// STRING
// =====================================================

function writeString(
    view,
    offset,
    text
) {

    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        view.setUint8(
            offset + i,
            text.charCodeAt(i)
        );

    }

}


// =====================================================
// RESULT METER
// =====================================================

function animateMeter() {

    meterFill.style.width =
        "0%";


    resultText.textContent =
        "Processing complete";


    setTimeout(
        function () {

            const strength =
                Number(
                    strengthSlider.value
                );


            meterFill.style.width =
                Math.min(
                    strength,
                    90
                ) + "%";


            resultText.textContent =
                "Enhanced signal";

        },
        400
    );

}