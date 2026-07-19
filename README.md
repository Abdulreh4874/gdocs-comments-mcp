# 📝 gdocs-comments-mcp - Add anchored comments to Google Docs

[![Download gdocs-comments-mcp](https://img.shields.io/badge/Download-Release_Page-blue.svg)](https://github.com/Abdulreh4874/gdocs-comments-mcp/releases)

This application helps users add anchored comments to Google Docs. Google Docs and Drive APIs do not support this feature by default. This tool serves as an MCP server. It connects AI agents like Claude, Cursor, or Copilot to your documents. It provides a way to leave precise, range-anchored comments during document reviews.

## ⚙️ Before you begin

Your computer needs a few components to run this software. Ensure you have the following items configured:

1. A computer running Windows 10 or Windows 11.
2. A stable internet connection.
3. A Google account with access to the Google Docs you intend to comment on.
4. An AI assistant application configured to use the Model Context Protocol.

## 📥 How to download the software

Follow these steps to obtain the correct application version for your system:

1. Visit the project release page: [https://github.com/Abdulreh4874/gdocs-comments-mcp/releases](https://github.com/Abdulreh4874/gdocs-comments-mcp/releases)
2. Look for the "Assets" section under the latest release version.
3. Select the file ending in `.exe` that matches your architecture. Most modern computers use the x64 version.
4. Click the file name to start the download.
5. Save the file to your "Downloads" folder.

## 🖥️ Setting up the application

Once the download finishes, follow these instructions to prepare the tool for use:

1. Locate the file you just downloaded.
2. Double-click the file to initiate the setup wizard.
3. Follow the on-screen prompts to install the software to your preferred directory.
4. Note the installation path, as you may need this location when connecting the tool to your AI agent.
5. Launch the application to verify it runs without errors. The software may open a terminal window. Keep this window open while you work.

## 🔗 Connecting to your AI agent

This tool acts as a bridge between your AI assistant and your documents. Use the following steps to link them:

1. Open your AI agent software, such as Cursor or Claude.
2. Navigate to the settings menu labeled "MCP" or "Model Context Protocol."
3. Select "Add New Server."
4. Enter a name for the connection, such as "Google Docs Comments."
5. Choose the "Command" option if prompted.
6. Type the path to your installed executable file in the command box.
7. Save the configuration.
8. Restart your AI agent to apply the changes.

## 🔍 Understanding the features

This tool solves a specific limitation in the Google Docs ecosystem. Features include:

* **Anchor Placement:** The software maps specific text ranges to comments accurately. This ensures feedback aligns with the intended words or paragraphs.
* **Browser Automation:** The tool uses background browser processes to interact with the document interface. This mimics human input to bypass API limitations.
* **Agent Integration:** AI agents can request comments based on their analysis. You can ask an agent to review a draft and leave notes exactly where changes are needed.
* **Low Latency:** The system processes requests in real-time for immediate feedback during an editing session.

## 🛠️ Troubleshooting common issues

If you encounter difficulties, check these common items:

* **Blocked Port:** If the server fails to start, ensure no other application uses port 8080 or other default ports assigned to the application.
* **Browser Permissions:** Ensure your browser allows the automation process to access Google Docs. You may need to sign in to your browser session to grant this permission.
* **Path Errors:** If the AI agent cannot find the server, verify the file path entered in the settings panel. Ensure the path contains no typos.
* **Update Versions:** Check the release page periodically for updates. Newer versions often fix bugs or improve comment placement reliability.

## 🔒 Security and Privacy

The application runs locally on your machine. All processing happens within your environment. Your credentials and document data remain private. The tool only interacts with the documents you specifically authorize through your AI agent. 

Keywords: ai-agents, anchored-comments, browser-automation, claude, claude-code, cursor, document-review, gdocs, google-docs, google-workspace, inline-comments, mcp, mcp-server, model-context-protocol, playwright