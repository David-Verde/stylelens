import * as vscode from 'vscode';
import { analyzeWorkspace } from '../analyzer/workspaceAnalyzer';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'stylelens.mainView';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'analyzeWorkspace': {
                    vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "StyleLens: Analizando estilos...",
                        cancellable: false
                    }, async (progress) => {
                        progress.report({ increment: 0, message: "Buscando archivos..." });
                        const results = await analyzeWorkspace();
                        progress.report({ increment: 100, message: "Análisis completado." });
                        this._view?.webview.postMessage({
                            type: 'analysisResult',
                            payload: results
                        });
                    });
                    break;
                }
                case 'onInfo': {
                    if (!data.value) { return; }
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case 'onError': {
                    if (!data.value) { return; }
                    vscode.window.showErrorMessage(data.value);
                    break;
                }
            }
        });
    }

 private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

   
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>StyleLens Panel</title>
        <style>
          body {
              font-family: var(--vscode-font-family);
              color: var(--vscode-editor-foreground);
              background-color: var(--vscode-editor-background);
          }
          button {
              background-color: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: 1px solid var(--vscode-button-border, transparent);
              padding: 4px 8px;
              cursor: pointer;
          }
          button:hover {
              background-color: var(--vscode-button-hover-background);
          }
          table {
              width: 100%;
              border-collapse: collapse;
          }
          th, td {
              padding: 8px;
              text-align: left;
              border-bottom: 1px solid var(--vscode-editor-widget-border);
          }
          th {
              font-weight: bold;
          }
          code {
              background-color: var(--vscode-textCodeBlock-background);
              padding: 2px 4px;
              border-radius: 3px;
              font-family: var(--vscode-editor-font-family);
          }
        </style>
    </head>
    <body>
        <h1>Panel de StyleLens</h1>
        <p>¡Bienvenido a tu dashboard de estilos!</p>
        <button id="analyze-button">Analizar Workspace</button>
        <div id="results"></div>

        <script nonce="${nonce}">
            const vscodeApi = acquireVsCodeApi();
            const resultsDiv = document.getElementById('results');

            document.getElementById('analyze-button').addEventListener('click', () => {
                vscodeApi.postMessage({ type: 'analyzeWorkspace' });
                resultsDiv.innerHTML = '<p>Analizando, por favor espera...</p>';
            });

            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.type) {
                    case 'analysisResult':
                        renderResults(message.payload);
                        break;
                }
            });

            function renderResults(results) {
                if (!results || results.length === 0) {
                    resultsDiv.innerHTML = '<p>¡Genial! No se encontraron estilos repetidos en el proyecto.</p>';
                    return;
                }

                let html = \`
                    <table>
                        <thead>
                            <tr>
                                <th>Combinación de Clases</th>
                                <th>Apariciones</th>
                                <th>Archivos</th>
                            </tr>
                        </thead>
                        <tbody>
                \`;
                
                for (const result of results) {
                    const escapedClassString = result.classString.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    
                    html += \`
                        <tr>
                            <td><code>\${escapedClassString}</code></td>
                            <td>\${result.count}</td>
                            <td>\${result.files.join('<br>')}</td>
                        </tr>
                    \`;
                }

                html += '</tbody></table>';
                resultsDiv.innerHTML = html;
            }
        </script>
    </body>
    </html>`;
}
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}