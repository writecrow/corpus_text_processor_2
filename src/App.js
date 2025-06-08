import './App.css';
import JSZip from 'jszip';
import * as chardet from 'jschardet';
import { extractText, getDocumentProxy } from 'unpdf'
import PizZip from "pizzip";
import { DOMParser } from "@xmldom/xmldom";

//@todo:
// Retain file structure

let fileUpload = document.getElementById("fileUpload");
let utf8 = document.getElementById("utf8");
let tableBody = document.getElementById("tableBody");
let processed = [];

/* Initialize start state */
document.addEventListener("DOMContentLoaded", function () {
  utf8.setAttribute("disabled", "disabled");
  fileUpload.value = null;
});

/* BEGIN HELPER FUNCTIONS */

// See https://github.com/mozilla/pdf.js/issues/11960
// and https://stackoverflow.com/questions/40482569/troubles-with-pdf-js-promises/40494019#40494019
async function gettext(pdfUrl) {
  const buffer = await fetch(pdfUrl)
    .then(res => res.arrayBuffer())
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true })
  return text;
}

const readUploadedFileAsText = (inputFile) => {
  const temporaryFileReader = new FileReader();
  return new Promise((resolve, reject) => {
    temporaryFileReader.onerror = () => {
      temporaryFileReader.abort();
      reject(new DOMException("Problem parsing input file."));
    };
    temporaryFileReader.onload = () => {
      resolve(temporaryFileReader.result);
    };
    temporaryFileReader.readAsText(inputFile);
  });
};

const ReadDocx = (file) => {
  const temporaryFileReader = new FileReader();
  return new Promise((resolve, reject) => {
    temporaryFileReader.onerror = () => {
      temporaryFileReader.abort();
      reject(new DOMException("Problem parsing input file."));
    };
    temporaryFileReader.onload = (e) => {
      resolve(temporaryFileReader.result);
    };
    temporaryFileReader.readAsArrayBuffer(file);
  });
}

function str2xml(str) {
  if (str.charCodeAt(0) === 65279) {
    // BOM sequence
    str = str.substr(1);
  }
  return new DOMParser().parseFromString(str, "text/xml");
}

// Get paragraphs as javascript array
function getParagraphs(content) {
  const zip = new PizZip(content);
  const xml = str2xml(zip.files["word/document.xml"].asText());
  const paragraphsXml = xml.getElementsByTagName("w:p");
  const paragraphs = [];

  for (let i = 0, len = paragraphsXml.length; i < len; i++) {
    let fullText = "";
    const textsXml = paragraphsXml[i].getElementsByTagName("w:t");
    for (let j = 0, len2 = textsXml.length; j < len2; j++) {
      const textXml = textsXml[j];
      if (textXml.childNodes) {
        fullText += textXml.childNodes[0].nodeValue;
      }
    }
    if (fullText) {
      paragraphs.push(fullText);
    }
  }
  return paragraphs;
}

String.prototype.hashCode = function () {
  var hash = 0,
    i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

function validateFile(file) {
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return true;
  }
  else if (file.type !== 'text/plain') {
    return false;
  }
  return true;
}

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/* END HELPER FUNCTIONS */

/**
 * Convert text files to `utf8`.
 */
document.getElementById("utf8").addEventListener("click", (event) => {
  event.preventDefault();
  generateDownload();
})

async function generateDownload() {
  var zip = new JSZip();
  for (const result of processed) {
    // Print message to screen and zip processed files
    let results = document.getElementById(result.hash + 'result');

    if (result.data !== null) {
      zip.file(result.name + '.txt', result.data);
      results.innerHTML = '<span>Processed successfully</span>';
    }
    else {
      if (result.result !== null) {
        results.innerHTML = '<span>' + result.result + '</span>';
      }
      else {
        results.innerHTML = '<span>Unable to process</span>';
      }
    }
  }
  const zipData = await zip.generateAsync({ type: "blob" });
  const link = document.getElementById("download");
  link.classList.add("ready");
  const d = new Date();
  const timestamp = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
  link.href = window.URL.createObjectURL(zipData);
  link.download = "processed-" + timestamp + ".zip";
}

/**
 * When a directory is selected, display a list of files.
 */
fileUpload.onchange = function () {
  tableBody.innerHTML = '';
  const link = document.getElementById("download");
  link.classList.remove("ready");
  if (this.files.length > 0) {

    let files = Array.from(this.files);

    Array.from(this.files).forEach(file => {
      tableBody.innerHTML += "<tr><td>" + file.name + "</td><td>" + file.type + "</td><td>" + formatBytes(file.size) + "</td><td id='" + file.webkitRelativePath.hashCode() + "analysis'></td><td id='" + file.webkitRelativePath.hashCode() + "result'></td></tr>";
    });
    processFiles(files);
    utf8.removeAttribute("disabled");
  }
};

/** MAIN BUSINESS LOGIC */


/**
 * Send files for processing and populate results summary.
 */
async function processFiles(files) {
  const promiseArray = []
  for (const file of files) {
    promiseArray.push(processFile(file));
  }
  processed = await Promise.all(promiseArray);
  for (const result of processed) {
    // Print message to screen and zip processed files
    const analysis = document.getElementById(result.hash + 'analysis');
    analysis.innerHTML = result.analysis;
  }
}

function getAnalysis(file, fileContents) {
  const encoding = chardet.detect(fileContents);
  let validated = validateFile(file);
  if (validated === false) {
    return '<span class="warning">&#9888; This file type is not supported.</span>';
  }
  return 'Detected encoding: ' + encoding['encoding'];
}

/**
 * Process a single file, provide a result message & text body.
 */
async function processFile(file) {
  let result = {
    'hash': file.webkitRelativePath.hashCode(),
    'name': file.name,
    'analysis': '',
    'result': '',
    'data': null,
  };
  // Validation.
  let fileContents = '';
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const docxData = await ReadDocx(file);
    const paragraphs = getParagraphs(docxData);
    const fileContents = paragraphs.join('\n');
    result.data = fileContents;
    result.analysis = getAnalysis(file, fileContents);
  }
  else if (file.type === 'application/pdf') {
    const url = URL.createObjectURL(file);
    gettext(url).then(function (text) {
      fileContents = text;
      result.data = fileContents;
      result.analysis = getAnalysis(file, '');
    },
    function (reason) {
      result.analysis = reason;
    });
  }
  else if (file.type !== 'text/plain') {
    result.analysis = getAnalysis(file, '');
  }
  else {
    // Processing.
    try {
      fileContents = await readUploadedFileAsText(file);
      result.data = fileContents;
      result.analysis = getAnalysis(file, fileContents);
    }
    catch (e) {
      result.message = e.message;
    }
  }
  return result;
}

function App() {
  return (
    <div className="App">
    </div>
  );
}

export default App;
