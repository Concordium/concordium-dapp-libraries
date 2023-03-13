// Import std lib modules.
const { EOL } = require('os');
const { readFileSync, writeFileSync } = require('fs');

// Read inputs and file to which we write outputs.
const file = process.env.INPUT_FILE;
const version = process.env.INPUT_VERSION;
const outputFile = process.env.GITHUB_OUTPUT;

// Read changelog file synchronously into a list of lines.
const lines = readFileSync(file, 'utf8').split(/\r?\n/);

// Find line index of the section of interest.
const sectionHeaderPattern = /^## \[(.*)]/;
const sectionLineIdx = lines.findIndex((line) => {
    const v = sectionHeaderPattern.exec(line);
    return v && version.startsWith(v[1]);
});

// If a matching section was found, extract to end of file look for the line index of the next section in this slice.
// Otherwise, leave the list of extracted lines empty.
let extractedLines = [];
if (sectionLineIdx >= 0) {
    extractedLines = lines.slice(sectionLineIdx);
    const nextSectionLineIdx = extractedLines.findIndex((line, idx) => idx > 0 && sectionHeaderPattern.test(line));
    // If a subsequent section was found, extract the lines up to and excluding the next section.
    if (nextSectionLineIdx >= 0) {
        extractedLines = extractedLines.slice(0, nextSectionLineIdx);
    }
}

// Join extracted lines and trim surrounding whitespace. Trailing newline will be (re)added in 'toOutput'.
const res = extractedLines.join(EOL).trim();

// Write result as an output.
function toOutput(key, delimiter, value) {
    return `${key}<<${delimiter}${EOL}${value}${EOL}${delimiter}${EOL}`;
}
try {
    writeFileSync(outputFile, toOutput('changelog', 'EOT', res), { encoding: 'utf8' });
} catch (e) {
    // TODO Report write error properly.
    console.error(`error: cannot write output file ${outputFile}:`, e);
}
