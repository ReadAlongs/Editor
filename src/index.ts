import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "./regions";

// Will be removed by webpack
require("purecss");
require("./index.css");

class App {
    wavesurfer: WaveSurfer;
    audio_input: HTMLInputElement;
    ras_input: HTMLInputElement;
    zoom_in: HTMLButtonElement;
    zoom_out: HTMLButtonElement;

    constructor() {
        this.audio_input = document.getElementById(
            "audio-input"
        ) as HTMLInputElement;
        this.ras_input = document.getElementById(
            "ras-input"
        ) as HTMLInputElement;
        this.zoom_in = document.getElementById("zoom-in") as HTMLButtonElement;
        this.zoom_out = document.getElementById(
            "zoom-out"
        ) as HTMLButtonElement;
        this.wavesurfer = WaveSurfer.create({
            container: "#wavesurfer",
            progressColor: "#999",
            waveColor: "#999",
            cursorColor: "red",
            plugins: [
                RegionsPlugin.create({
                    contentEditable: true,
                    removeButton: true,
                    formatTimeCallback: (start: number, end: number) =>
                        `${start.toFixed(2)}:${end.toFixed(2)}`,
                }),
            ],
            scrollParent: true,
            height: 200,
            minPxPerSec: 300, // FIXME: uncertain about this
        });
    }

    load_audiofile(audio_file: File | Blob) {
        this.wavesurfer.loadBlob(audio_file);
        this.wavesurfer.clearRegions();
    }

    async load_readalong(ras_file: File) {
        const text = await ras_file.text();
        this.parse_readalong(text);
    }

    async parse_readalong(text: string) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/html");
        const readalong = xml.querySelector("read-along");
        if (readalong === null) return;
        const audio = readalong.getAttribute("audio");
        if (audio !== null) {
            const reply = await fetch(audio);
            if (reply.ok) {
                const blob = await reply.blob();
                this.load_audiofile(blob);
            }
        }
        const href = readalong.getAttribute("href");
        if (href === null) this.create_regions(readalong);
        else {
            const reply = await fetch(href);
            if (reply.ok) {
                const text2 = await reply.text();
                // FIXME: potential zip-bombing?
                this.parse_readalong(text2);
            }
        }
    }

    create_regions(readalong: Element) {
        this.wavesurfer.clearRegions();
        for (const w of Array.from(readalong.querySelectorAll("w[id]"))) {
            const wordText = w.textContent;
            const startText = w.getAttribute("time");
            const durText = w.getAttribute("dur");
            if (wordText == null || startText == null || durText == null)
                continue;
            const startTime = parseFloat(startText);
            const endTime = startTime + parseFloat(durText);
            this.wavesurfer.addRegion({
                data: { text: wordText.trim() },
                start: startTime,
                end: endTime,
            });
        }
    }

    initialize() {
        this.audio_input.addEventListener("change", () => {
            if (this.audio_input.files && this.audio_input.files[0])
                this.load_audiofile(this.audio_input.files[0]);
        });
        this.ras_input.addEventListener("change", async () => {
            if (this.ras_input.files && this.ras_input.files[0])
                this.load_readalong(this.ras_input.files[0]);
        });
        this.zoom_in.addEventListener("click", () => {
            this.wavesurfer.zoom(this.wavesurfer.params.minPxPerSec * 1.25);
        });
        this.zoom_out.addEventListener("click", () => {
            this.wavesurfer.zoom(this.wavesurfer.params.minPxPerSec / 1.25);
        });
        this.wavesurfer.on("region-click", (region, e) => {
            console.log(
                `${region.data.text}: ${region.start} -> ${region.end}`
            );
            e.stopPropagation();
            region.play();
        });
    }
}

window.addEventListener("load", () => {
    const app = new App();
    app.initialize();
});
