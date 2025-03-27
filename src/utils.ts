import axios from "axios";
import FormData from "form-data";
import * as fs from "fs";
import path from "path";
import * as vscode from "vscode";
// @ts-ignore
import * as recorder from "node-record-lpcm16";
import OpenAI from "openai";

const OPENAI_API_KEY = "";
const OPENAI_WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const CODE_GENERATION_SYSTEM_PROMPT = `
You are an advanced AI coding assistant that generates and edits high-quality, efficient, and maintainable code across a wide range of languages, frameworks, and environments. You receive structured context and prompts from a VS Code extension, and your job is to provide clear, correct, and concise code output tailored to the user's request.

### General Code Guidelines

1. **Correctness & Best Practices**
- Always return **fully functional and syntactically correct code**.
- Follow **best practices** and **modern standards** for the target language or framework.
- Ensure compatibility with **relevant environments and tools**.

2. **Clarity & Readability**
- Use **descriptive names** for variables, functions, and types.
- Avoid wrapping code in markdown formatting (no backticks or language tags).
- Add **concise comments** only where they clarify non-obvious logic.
- Structure complex code into **modular, reusable functions**.

3. **Minimal Dependencies**
- Avoid third-party libraries unless explicitly requested.
- If using one, explain its purpose and provide the installation command (e.g. \`npm install\`).

4. **Response Format**
- Output **only the requested code** with no extra commentary or text unless asked.
- Format code with **consistent indentation and spacing**.
- **Never include <file>, <codebase>, or <prompt> tags** in your response.
- **Never repeat the prompt or codebase context** back in the response.

5. **Robustness**
- Add **basic error handling** where appropriate (e.g., input checks, try-catch).
- Account for **edge cases and unexpected inputs**.

---

### Prompt Format

You'll receive one of the following types of prompts:

#### 💻 Code Generation
Wrapped in '<codebase>' and '<prompt>' tags:
\`\`\`
<codebase>
<file name="filename.ext">
// content here
</file>
...
</codebase>
<prompt>
The user's request goes here.
</prompt>
\`\`\`

- Use the '<codebase>' to understand the existing project structure, helpers, naming conventions, and logic.
- If the prompt asks for **new functionality**, add it in a way that is **consistent** with the codebase.
- Reference or reuse existing functions/types/components where relevant.
- Modify only necessary files to satisfy the request.
- Do **not repeat or return the entire file** unless explicitly asked.
- Do **not** wrap your output in <file> tags unless specifically instructed to.

#### ✏️ Code Editing
Wrapped in '<file>' and '<prompt>' tags:
\`\`\`
<file>
// Full file content to be edited
</file>
<prompt>
The user's editing request.
</prompt>
\`\`\`

- Parse the full file in '<file>' and make the necessary **edits only**.
- Preserve unrelated code.
- Avoid unnecessary rewrites — focus on fulfilling the exact request.
- Refactor instead of rewriting unless told otherwise.

---

### Supported Capabilities

- Generate and complete code for **frontend**, **backend**, **databases**, **automation**, **AI/ML**, etc.
- Assist with **debugging**, **refactoring**, **documentation**, and **performance optimization**.
- Set up **project scaffolds**, e.g., "Initialize a Node.js API with Express".
- Write **unit and integration tests**.
- Explain **concepts, functions, or bugs** if explicitly asked.

---

Respond with clarity, precision, and a professional tone. Always assume the provided codebase reflects the **latest state of the project**.
`;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function recordAudioToFile(outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Ensure the directory exists before writing the file
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true }); // Create the tmp directory if it doesn't exist
    }

    console.log(`Recording audio to: ${outputPath}`);

    const fileStream = fs.createWriteStream(outputPath, { encoding: "binary" });

    fileStream.on("error", (err) => {
      console.error("File write error:", err);
      reject(err);
    });

    fileStream.on("finish", () => {
      console.log(`File successfully written: ${outputPath}`);
      resolve(outputPath);
    });

    const recording = recorder.record({
      sampleRate: 16000,
      channels: 1,
      audioType: "mp3",
      endOnSilence: true,
      silence: "3.0",
    });

    recording.stream().pipe(fileStream);
  });
}

export async function transcribeSpeech(audioFilePath: string) {
  // Send audio to OpenAI Whisper
  try {
    if (!fs.existsSync(audioFilePath)) {
      console.error("File not found:", audioFilePath);
      throw new Error("File not found");
    }

    const formData = new FormData();
    formData.append("file", fs.createReadStream(audioFilePath));
    formData.append("model", "whisper-1");

    const headers = {
      ...formData.getHeaders(),
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    };

    const response = await axios.post(OPENAI_WHISPER_API_URL, formData, {
      headers,
    });

    const transcript = response.data.text;
    console.log("Transcript: ", transcript);
    return transcript;
  } catch (error: any) {
    console.error("Whisper API Error:", error.response?.data || error.message);
  }
}

export function getWorkspaceContext(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return "";

  let context = "";
  const folderPath = workspaceFolders[0].uri.fsPath;

  const files = fs.readdirSync(folderPath, { withFileTypes: true });
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = file.name;
    try {
      const content = fs.readFileSync(`${file.parentPath}/${name}`);
      context += `<file name="${name}">\n${content}\n</file>\n`;
    } catch (e) {
      console.log(e);
    }
  }
  return context;
}

export async function getSpeechInput(): Promise<string | null> {
  // Save recording
  const audioFileName = "tmp/voice_input.mp3";
  const audioFilePath = path.join(__dirname, audioFileName);
  const outputPath = await recordAudioToFile(audioFilePath);

  vscode.window.showInformationMessage("Processing speech...");

  const transcript = await transcribeSpeech(outputPath);

  if (transcript) return transcript.toLowerCase();

  return "";
}

export async function saveChanges() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  try {
    const document = editor.document;
    await document.save();
  } catch (error) {
    console.error(`Failed to save document: ${error}`);
    vscode.window.showErrorMessage(`Failed to save document: ${error}`);
  }
}

export async function generateCode(prompt: string) {
  const editor = vscode.window.activeTextEditor;

  if (!editor) return;

  try {
    const context = getWorkspaceContext();
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: CODE_GENERATION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            "<codebase>",
            context,
            "</codebase>",
            "<prompt>",
            prompt.trim(),
            "</prompt>"
          ].join()
        },
      ],
      stream: true,
    });

    let buffer = "";

    for await (const part of stream) {
      const code = part.choices[0]?.delta?.content || "";
      buffer += code;

      if (buffer.endsWith("\n") || code === "") {
        editor.edit((editBuilder) => {
          editBuilder.insert(editor.selection.active, buffer);
        });
        buffer = "";
      }
    }
    saveChanges();
    vscode.window.showInformationMessage("Code inserted!");
  } catch (error) {
    console.error(`Failed to generate code: ${error}`);
    vscode.window.showErrorMessage(`Failed to generate code: ${error}`);
  }
}

export async function editCode(prompt: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );

  const response = await axios.post(
    OPENAI_API_URL,
    {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: CODE_GENERATION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `<file>\n${document.getText()}\n</file>\n<prompt>\n${prompt}\n</prompt>. `,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      responseType: "text",
    }
  );

  const data = JSON.parse(response.data);
  const code = data.choices[0].message.content;
  console.log("Successfully generated script: ", code);

  await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, code);
  });
  saveChanges();
}

// Files
export async function openFile(fileName: string) {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders) {
    vscode.window.showErrorMessage("Open a folder first");
    return;
  }

  const filePath = vscode.Uri.file(
    `${workspaceFolders[0].uri.fsPath}/${fileName}`
  );

  try {
    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document);
    vscode.window.showInformationMessage(`Opened file: ${filePath}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Error opening file: ${error}`);
  }
}

export async function createFileInWorkspace(fileName: string, content: string) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("Open a folder first!");
    return;
  }

  let cleanedFileName = fileName.endsWith(".")
    ? fileName.slice(0, fileName.length - 1)
    : fileName;

  const filePath = vscode.Uri.file(
    `${workspaceFolders[0].uri.fsPath}/${cleanedFileName}`
  );
  await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, "utf8"));
}

export async function deleteFileInWorkspace(fileName: string) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("Open a folder");
    return;
  }
  let cleanedFileName = fileName.endsWith(".")
    ? fileName.slice(0, fileName.length)
    : fileName;

  const filePath = vscode.Uri.file(
    `${workspaceFolders[0].uri.fsPath}/${cleanedFileName}`
  );

  await vscode.workspace.fs.delete(filePath);
}
