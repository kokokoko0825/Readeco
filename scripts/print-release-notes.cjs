const fs = require('node:fs');
const notes = require('../constants/release-notes.json');

function renderReleaseNote(note) {
  return `# ${note.title}\n\n${note.date}${note.version ? ` · v${note.version}` : ''}\n\n${note.changes.map((change) => `- ${change.text}`).join('\n')}\n`;
}

if (require.main === module) {
  const [id = notes[0].id, outputPath] = process.argv.slice(2);
  const note = notes.find((entry) => entry.id === id);
  if (!note) {
    console.error(`Unknown release note ID: ${id}`);
    process.exitCode = 1;
  } else if (outputPath) {
    fs.writeFileSync(outputPath, renderReleaseNote(note));
    console.log(`Release note written: ${outputPath}`);
  } else {
    process.stdout.write(renderReleaseNote(note));
  }
}

module.exports = { renderReleaseNote };
