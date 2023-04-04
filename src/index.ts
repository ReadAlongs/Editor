import WaveSurfer from "wavesurfer.js";
import SegmentsPlugin, { Segment } from "./segments";

// Will be removed by webpack
require("purecss");
require("./index.css");

class App {
    wavesurfer: WaveSurfer;
    audio_input: HTMLInputElement;
    ras_input: HTMLInputElement;
    zoom_in: HTMLButtonElement;
    zoom_out: HTMLButtonElement;
    download_button: HTMLButtonElement;
    readalong: Document | null;
    readalong_element: Element;

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
        this.download_button = document.getElementById(
            "download"
        ) as HTMLButtonElement;
        this.wavesurfer = WaveSurfer.create({
            container: "#wavesurfer",
            progressColor: "#999",
            waveColor: "#999",
            cursorColor: "red",
            plugins: [
                SegmentsPlugin.create({
                    contentEditable: true,
                }),
            ],
            scrollParent: true,
            height: 200,
            minPxPerSec: 300, // FIXME: uncertain about this
        });
    }

    load_audiofile(audio_file: File | Blob) {
        this.wavesurfer.loadBlob(audio_file);
        this.wavesurfer.clearSegments();
        this.download_button.disabled = false;
    }

    async load_readalong(ras_file: File) {
        const text = await ras_file.text();
        this.readalong = await this.parse_readalong(text);
    }

    async parse_readalong(text: string): Promise<Document | null> {
        const parser = new DOMParser();
        const readalong = parser.parseFromString(text, "text/html");
        const element = readalong.querySelector("read-along");
        if (element === null) return null;
        // We can always download *something* (FIXME: will reconsider)
        this.download_button.disabled = false;
        // Oh, there's an audio file, okay, try to load it
        const audio = element.getAttribute("audio");
        if (audio !== null) {
            const reply = await fetch(audio);
            // Did that work? Great!
            if (reply.ok) {
                const blob = await reply.blob();
                this.load_audiofile(blob);
                // Clear previously selected file
                this.audio_input.value = "";
                this.download_button.disabled = true;
            }
        }
        // Is read-along linked (including data URI) or embedded?
        const href = element.getAttribute("href");
        if (href === null) this.create_segments(element);
        else {
            const reply = await fetch(href);
            if (reply.ok) {
                const text2 = await reply.text();
                // FIXME: potential zip-bombing?
                this.parse_readalong(text2);
            }
        }
        return readalong;
    }

    download() {
        // Perhaps the download button should actually be a link
        const element = document.createElement("a");
        if (
            this.readalong === null ||
            this.ras_input.files === null ||
            this.ras_input.files.length === 0 ||
            this.ras_input.files[0] === null
        ) {
            this.download_button.disabled = true;
            throw "nothing to download";
        }
        this.adjust_alignment(this.readalong_element);
        const filetype = this.ras_input.files[0].type;
        if (filetype === "text/html") {
            // This may not be the same as this.readalong_element in the case where it was a data URL
            const outer_ras = this.readalong.querySelector("read-along");
            if (outer_ras == null) {
                this.download_button.disabled = true;
                throw "failed to find <read-along> element";
            }
            if (outer_ras !== this.readalong_element) {
                // If it was Base-64, re-encode it as Base-64
                // See https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
                const xml = new XMLSerializer().serializeToString(
                    this.readalong_element
                );
                const b64ras = window.btoa(
                    encodeURIComponent(xml).replace(
                        /%([0-9A-F]{2})/g,
                        function (match, p1) {
                            return String.fromCharCode(parseInt(p1, 16));
                        }
                    )
                );
                outer_ras.setAttribute(
                    "href",
                    "data:application/readalong+xml;base64," + b64ras
                );
            }
            // Otherwise there is nothing to do as we already updated it in adjust_alignment
            const blob = new Blob([this.readalong.documentElement.outerHTML], {
                type: filetype,
            });
            element.href = window.URL.createObjectURL(blob);
        } else {
            const xml = new XMLSerializer().serializeToString(
                this.readalong_element
            );
            const blob = new Blob([xml], { type: filetype });
            element.href = window.URL.createObjectURL(blob);
        }
        element.download = this.ras_input.files[0].name;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    adjust_alignment(element: Element) {
        const segments: { [id: string]: Segment } = {};
        for (const s of Object.values(this.wavesurfer.segments.list)) {
            const segment = s as Segment;
            segments[segment.data.id as string] = segment;
        }
        for (const w of Array.from(element.querySelectorAll("w[id]"))) {
            const wordId = w.getAttribute("id");
            if (wordId == null) continue;
            const segment = segments[wordId];
            if (!segment)
                // deletions not allowed for now
                throw `missing segment for ${wordId}`;
            w.setAttribute("time", segment.start.toFixed(3));
            w.setAttribute("dur", (segment.end - segment.start).toFixed(3));
            w.textContent = segment.data.text as string;
        }
    }

    create_segments(element: Element) {
        this.wavesurfer.clearSegments();
        this.readalong_element = element;
        for (const w of Array.from(element.querySelectorAll("w[id]"))) {
            const wordText = w.textContent;
            const wordId = w.getAttribute("id");
            const startText = w.getAttribute("time");
            const durText = w.getAttribute("dur");
            if (wordText == null || startText == null || durText == null)
                continue;
            const startTime = parseFloat(startText);
            const endTime = startTime + parseFloat(durText);
            this.wavesurfer.addSegment({
                data: { id: wordId, text: wordText.trim() },
                start: startTime,
                end: endTime,
            });
        }
    }

    initialize() {
        this.audio_input.addEventListener("change", () => {
            if (this.audio_input.files && this.audio_input.files[0]) {
                this.load_audiofile(this.audio_input.files[0]);
                this.ras_input.value = "";
                this.download_button.disabled = true;
            }
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
        this.download_button.addEventListener("click", () => this.download());
        this.wavesurfer.on("segment-click", (segment, e) => {
            e.stopPropagation();
            segment.play();
        });
    }
}

window.addEventListener("load", () => {
    const app = new App();
    app.initialize();
});
