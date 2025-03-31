# Voice Coding Extension
- This is a VS Code Extension

## How It Was Made
[🎥 YouTube Video](https://youtu.be/d-9JnIlwRkM)

## ✨ Features

- 🎙️ **Voice Commands**: Speak naturally to perform dev tasks
- 📄 **Create / Open / Delete Files**
- ✏️ **Generate or Edit Code** using OpenAI GPT (GPT-4o-mini)
- ⚡ **Live Server Trigger**: Start your server with a voice command
- 🧠 **Code Context Awareness**: Sends your entire project structure to the LLM for smarter responses

---

## 📦 How It Works

1. You trigger the extension with the command:  
   `Voice Coding: Start` → Begins listening for your voice.

2. Your voice input is:
   - Recorded via `node-record-lpcm16`
   - Transcribed using **OpenAI Whisper**

3. The transcribed command is parsed. Based on the input, it does one of the following:

| Voice Input Example                  | Action                              |
|-------------------------------------|-------------------------------------|
| `"Create a file named signup.js"`   | Creates `signup.js` in your workspace |
| `"Open index.html"`                 | Opens `index.html` in the editor     |
| `"Delete utils.js"`                 | Deletes `utils.js` from workspace    |
| `"Generate a React signup form"`    | Sends prompt to GPT and inserts code |
| `"Edit this file to use fetch"`     | Sends current file to GPT with edit prompt |
| `"Go live"`                         | Triggers Live Server                 |

4. The code is inserted directly into VS Code using the editor API.

---

## 🧠 How the AI Works

- Uses **OpenAI Whisper** to transcribe audio
- Sends full project context to **GPT-4o-mini** for code generation/editing
- System prompt enforces:
  - Best practices
  - Minimal dependencies
  - Clean output (no Markdown, no extra commentary)

---

## 🚀 Commands

| Command                  | Description                                |
|--------------------------|--------------------------------------------|
| `voiceCoding.start`      | Starts listening and processing voice      |
| `voiceCoding.test`       | Dumps current workspace context to console |
