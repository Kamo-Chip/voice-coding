import * as vscode from "vscode";
import {
  createFileInWorkspace,
  deleteFileInWorkspace,
  editCode,
  generateCode,
  getSpeechInput,
  getWorkspaceContext,
  openFile,
} from "./utils";

export function activate(context: vscode.ExtensionContext) {
  const start = vscode.commands.registerCommand(
    "voiceCoding.start",
    async () => {
      vscode.window.showInformationMessage("Listening...");
      const userCommand = await getSpeechInput();

      if (userCommand) {
        vscode.window.showInformationMessage(`Heard: ${userCommand}`);
        await processVoiceCommand(userCommand);
      }
    }
  );

  const testingUtil = vscode.commands.registerCommand(
    "voiceCoding.test",
    async () => {
      await getWorkspaceContext();
    }
  );
  context.subscriptions.push(start, testingUtil);
}

export function deactivate() {}

async function processVoiceCommand(command: string) {
  command = command.toLowerCase();

  if (command.startsWith("create a file named")) {
    const fileName = command.replace("create a file named", "").trim();
    await createFileInWorkspace(fileName, "");
  } else if (command.startsWith("delete")) {
    const fileName = command.replace("delete", "").trim();
    await deleteFileInWorkspace(fileName);
  } else if (command.startsWith("open")) {
    const fileName = command.replace("open", "").trim();
    await openFile(fileName);
  } else if (command.startsWith("generate")) {
    const prompt = command.trim();
    await generateCode(prompt);
  } else if (command.startsWith("edit")) {
    const prompt = command.trim();
    await editCode(prompt);
  } else if (command.startsWith("go live")) {
    vscode.commands.executeCommand("extension.liveServer.goOnline");
  } else {
    console.log("Unrecognised command: ", command);
    vscode.window.showErrorMessage("Unrecognised command: ", command);
  }
}
