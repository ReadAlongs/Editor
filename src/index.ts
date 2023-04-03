import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "./regions";

// Will be removed by webpack
require("purecss");
require("./index.css");

class App {
  wavesurfer: WaveSurfer;
  audio_input: HTMLInputElement;
  ras_input: HTMLInputElement;

  constructor() {
    this.audio_input = document.getElementById(
      "audio-input"
    ) as HTMLInputElement;
    this.ras_input = document.getElementById("ras-input") as HTMLInputElement;
    this.wavesurfer = WaveSurfer.create({
      container: "#wavesurfer",
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

  load_audiofile(audio_file: File) {
    this.wavesurfer.loadBlob(audio_file);
  }

  async load_readalong(ras_file: File) {
    const parser = new DOMParser();
    const text = await ras_file.text();
    const xml = parser.parseFromString(text, "text/html");
    for (const w of Array.from(xml.querySelectorAll("read-along w[id]"))) {
      const wordText = w.textContent;
      const startText = w.getAttribute("time");
      const durText = w.getAttribute("dur");
      if (wordText == null || startText == null || durText == null) continue;
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
      if (this.audio_input.files != null)
        this.load_audiofile(this.audio_input.files[0]);
    });
    this.ras_input.addEventListener("change", async () => {
      if (this.ras_input.files != null)
        this.load_readalong(this.ras_input.files[0]);
    });
    this.wavesurfer.on("region-click", (region, e) => {
      console.log(
        `${region.attributes.label}: ${region.start} -> ${region.end}`
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
