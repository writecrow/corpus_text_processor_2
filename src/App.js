import './App.css';
import JSZip from 'jszip';
import * as chardet from 'jschardet';
import { extractText, getDocumentProxy } from 'unpdf'
import PizZip from "pizzip";
import { DOMParser } from "@xmldom/xmldom";

//@todo:
// Retain file structure

let fileUpload = document.getElementById("fileUpload");
let process = document.getElementById("process");
let tableBody = document.getElementById("tableBody");
let processed = [];
const allowedTextExtensions = [
  'text/plain',
  'text/html',
];

/* Initialize start state */
document.addEventListener("DOMContentLoaded", function () {
  fileUpload.value = null;
  process.setAttribute("disabled", "disabled");
});

/* BEGIN HELPER FUNCTIONS */

function standardize(text) {
  var result = text;
  // https://symbl.cc/en/unicode-table/#general-punctuation
  // 0. Temporarily replace tab character with <TAB>
  const tabCharacter = '/\t/gm';
  const tabPlaceholder = '<TAB>';
  result = result.replace(tabCharacter, tabPlaceholder);
  // 1. Replace smart quotes with regular quotes
  result = result
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2034\u2036\u2037]/g, '"');
  // 2. Replace i with diacritics with quotes
  result = result
    .replace(/[ìí]/g, '"');
  // 3. Replace ellipsis with single period
  result = result
    .replace(/[\u2024\u2025\u2026]/g, ".");
  // 4. Replace Armenian apostrophe with regular
  result = result
    .replace(/[\u055a]/g, "'");
  // 5. Replace inverted question mark with nothing
  result = result
    .replace(/[\u00bf]/g, " ");
  // 6. Replace all dashes with hyphen
  result = result
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-");
  // 7. Sentence normalization
  const addSpace = `$1 $2`;
  const empty = '';
  const addPeriodSpace = `$1. $2`;
  const punctuationFollowedByNonSpace = /([.?;:])([A-Z][a-z]+)/gm;
  result = result.replace(punctuationFollowedByNonSpace, addSpace);
  const punctuationFollowedByTwoLowercase = /([,;:])([a-z][a-z]+)/gm;
  result = result.replace(punctuationFollowedByTwoLowercase, addSpace);
  const lowercaseFollowedByUppercase = /([a-z])([A-Z])/gm;
  result = result.replace(lowercaseFollowedByUppercase, addSpace);
  const punctuationFollowedByNumeral = /([.?;:])([0-9]+\s+)/gm;
  result = result.replace(punctuationFollowedByNumeral, addSpace);
  const lowerFollowedByNewlineUppercase = /([a-z])(\n[A-Z])/gm;
  result = result.replace(lowerFollowedByNewlineUppercase, addPeriodSpace);
  // 8. Replace newlines followed by lowercase character.
  const newlineFollowedByLowercase = /([a-z]+)\s*\n\s*([a-z]+)/gm;
  result = result.replace(newlineFollowedByLowercase, addSpace);
  // 9. Flatten diacritics
  result = result.replace(/[áàãäâåāăąǎȃȧ]/g, 'a');
  result = result.replace(/[ÁÀÃÄÂÅĀĂĄǍȂȦ]/g, 'A');
  result = result.replace(/[éèêëēĕėęěȇ]/g, 'e');
  result = result.replace(/[ÉÈÊËĒĔĖĘĚȆ]/g, 'E');
  result = result.replace(/[íìîïīĭįǐȋ]/g, 'i');
  result = result.replace(/[ÍÌÎÏĪĬĮİǏȊ]/g, 'I');
  result = result.replace(/[øóòöõôȏȯ]/g, 'o');
  result = result.replace(/[ØÓÒÖÕÔȎȮ]/g, 'O');
  result = result.replace(/[úùüûǔȗ]/g, 'u');
  result = result.replace(/[ÚÙÜÛǓȖ]/g, 'U');
  result = result.replace(/[ÝȲ]/g, 'Y');
  result = result.replace(/[ýÿȳ]/g, 'y');
  result = result.replace(/œ/g, 'oe');
  result = result.replace(/æ/g, 'ae');
  result = result.replace(/Æ/g, 'AE');
  result = result.replace(/[çćĉċč]/g, 'c');
  result = result.replace(/[ÇĆĈĊČ]/g, 'C');
  result = result.replace(/ñ/g, 'n');
  result = result.replace(/Ñ/g, 'N');
  // 10. Remove non-English characters.
  const anyNonEnglishCharacter = /[^\x00-\x7F]+/gm;
  result = result.replace(anyNonEnglishCharacter, empty);
  // 11. Replace multiple consecutive spaces with a single space.
  const multipleSpaces = / {2,}/gm;
  result = result.replace(multipleSpaces, ' ');
  // 12. Remove spaces at beginning of line.
  const spacesAtBeginningOfLine = /^ +|$/gm;
  result = result.replace(spacesAtBeginningOfLine, empty);
  // 13. Re-insert tab characters (see Step 0).
  result = result.replace(tabPlaceholder, tabCharacter);
  return result;
}

// See https://github.com/mozilla/pdf.js/issues/11960
// and https://stackoverflow.com/questions/40482569/troubles-with-pdf-js-promises/40494019#40494019
async function gettext(pdfUrl) {
  const buffer = await fetch(pdfUrl)
    .then(res => res.arrayBuffer())
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true })
  return text;
}

const readUploadedFileAsBuffer = (inputFile) => {
  const temporaryFileReader = new FileReader();
  return new Promise((resolve, reject) => {
    temporaryFileReader.onerror = () => {
      temporaryFileReader.abort();
      reject(new DOMException("Problem parsing input file."));
    };
    temporaryFileReader.onload = () => {
      resolve(temporaryFileReader.result);
    };
    temporaryFileReader.readAsArrayBuffer(inputFile);
  });
};

const readUploadedFileAsText = (inputFile, encoding) => {
  const temporaryFileReader = new FileReader();
  return new Promise((resolve, reject) => {
    temporaryFileReader.onerror = () => {
      temporaryFileReader.abort();
      reject(new DOMException("Problem parsing input file."));
    };
    temporaryFileReader.onload = () => {
      resolve(temporaryFileReader.result);
    };
    temporaryFileReader.readAsText(inputFile, encoding);
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
  else if (!allowedTextExtensions.includes(file.type)) {
    return false;
  }
  return true;
}

function getAnalysis(file, fileContents) {
  const encoding = chardet.detect(fileContents);
  let validated = validateFile(file);
  if (validated === false) {
    return '<span class="warning">&#9888; This file type is not supported.</span>';
  }
  return 'Detected encoding: ' + mapEncoding(encoding['encoding']);
}

function mapEncoding(format) {
  // The key is encoding provided by the`chardet`(see https://github.com/chardet/chardet).
  // The value is the encoding to use from iconv
  var encodingMap = {
    'ASCII': 'ascii',
    'BIG5': 'big5',
    'CP932': 'cp932',
    'GB2312': 'gb2312',
    'EUC-KR': 'euc-kr',
    'EUC-JP': 'euc-jp',
    'EUC-TW': 'gb18030',
    'HZ-GB-2312': 'hz',
    'IBM855': 'cp855',
    'IBM866': 'cp866',
    'ISO-2022-CN': 'gb2312',
    'ISO-2022-JP': 'iso-2022-jp',
    'ISO-2022-KR': 'iso-2022-kr',
    'ISO-8859-1': 'iso8859_1',
    'ISO-8859-2': 'iso8859-2',
    'ISO-8859-5': 'iso8859-5',
    'ISO-8859-7': 'iso8859-7',
    'ISO-8859-8': 'iso8859-8',
    'KOI8-R': 'koi8-r',
    'x-mac-cyrillic': 'cp1256',
    'MACCYRILLIC': 'cp1256',
    'SHIFT_JIS': 'shift-jis',
    'TIS-620': 'cp874',
    'WINDOWS-1251': 'windows-1251',
    'WINDOWS-1252': 'cp1252',
    'WINDOWS-1253': 'cp1253',
    'WINDOWS-1254': 'cp1254',
    'WINDOWS-1255': 'cp1255',
    'UTF-8-SIG': 'utf-8-sig',
    'UTF-16': 'utf-16',
    'UTF-32': 'utf-32',
    'UTF-32LE': 'utf-32',
  }
  if (format in encodingMap) {
    return encodingMap[format];
  }
  return format;
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
document.getElementById("process").addEventListener("click", (event) => {
  event.preventDefault();
  // Find which process should be run...
  var executor = '';
  var processors = document.getElementsByName('processor');
  for (var i = 0; i < processors.length; i++) {
    if (processors[i].checked)
      executor = processors[i].id;
  }
  if (executor === 'standardize') {
    standardizeAndDownload();
  }
  else if (executor === 'convert') {
    convertAndDownload();
  }
  else if (executor === 'utf8') {
    convertAndDownload();
  }
})

async function standardizeAndDownload() {
  var zip = new JSZip();
  for (const result of processed) {
    // Print message to screen and zip processed files
    let results = document.getElementById(result.hash + 'result');

    if (result.data !== null) {
      var standardized = standardize(result.data);
      zip.file(result.name + '.txt', standardized);
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

async function convertAndDownload() {
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
    process.removeAttribute("disabled");
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

function trimExtension(filename) {
  return filename.replace(/\.[^/.]+$/, "");
}

/**
 * Process a single file, provide a result message & text body.
 */
async function processFile(file) {
  let result = {
    'hash': file.webkitRelativePath.hashCode(),
    'name': trimExtension(file.name),
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
  else if (!allowedTextExtensions.includes(file.type)) {
    result.analysis = getAnalysis(file, '');
  }
  else {
    // Process text files.
    try {
      const arrayBuffer = await readUploadedFileAsBuffer(file);
      const binaryString = String.fromCharCode(...new Uint8Array(arrayBuffer));
      result.analysis = getAnalysis(file, binaryString);
      const encoding = chardet.detect(binaryString);
      if (!!encoding['encoding']) {
        let format = encoding['encoding'];
        format = mapEncoding(format);
        var decoded = await readUploadedFileAsText(file, format);
        result.data = decoded;
      }
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
