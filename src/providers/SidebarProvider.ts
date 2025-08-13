import * as vscode from 'vscode';
import { analyzeWorkspace, DetailedDuplicate } from '../analyzer/workspaceAnalyzer';
import { findDuplicateClasses, StyleUsage, normalizeClassString } from '../analyzer/jsxParser';
import { findDuplicateClassesInVue } from '../analyzer/vueParser';
import { findDuplicateClassesInSvelte } from '../analyzer/svelteParser';

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
                case 'openFile': {
                    const { filePath, line } = data.payload;
                    try {
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
                        if (!workspaceFolder) { return; }

                        const fileUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, filePath);
                        const doc = await vscode.workspace.openTextDocument(fileUri);
                        
                        const editor = await vscode.window.showTextDocument(doc);
                        const position = new vscode.Position(line - 1, 0);
                        editor.selection = new vscode.Selection(position, position);
                        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);

                    } catch (e) {
                        vscode.window.showErrorMessage(`No se pudo abrir el archivo: ${filePath}`);
                    }
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
                case 'refactorFromPanel': {
                    const result: DetailedDuplicate = data.payload;
                    
                    vscode.window.showInformationMessage(`Preparando refactorización para '${result.classString}'...`);

                    const newClassName = await vscode.window.showInputBox({
                        prompt: `Introduce un nombre para la nueva clase que reemplazará ${result.count} ocurrencias.`,
                        value: result.classString.split(' ')[0].replace(/[^a-zA-Z0-9-]/g, '') + '-style',
                        placeHolder: 'ej: card-layout, primary-button',
                        validateInput: text => /^[a-z0-9_-]+$/.test(text) ? null : 'Nombre inválido.',
                    });

                    if (!newClassName) return;

                    const locationsToUpdate = [];
                    for (const fileLoc of result.locations) {
                        const fileUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, fileLoc.filePath);
                        const document = await vscode.workspace.openTextDocument(fileUri);
                        
                        let usages: StyleUsage[] = [];
                        switch(document.languageId) {
                            case 'javascriptreact': case 'typescriptreact':
                                usages = findDuplicateClasses(document.getText());
                                break;
                            case 'vue':
                                usages = findDuplicateClassesInVue(document.getText());
                                break;
                            case 'svelte':
                                  usages = await findDuplicateClassesInSvelte(document);
                                break;
                        }
                        
                        const relevantUsages = usages.filter(u => normalizeClassString(u.classString) === result.classString);
                        const attributeName = (document.languageId === 'vue' || document.languageId === 'svelte') ? 'class' : 'className';

                        for (const usage of relevantUsages) {
                            locationsToUpdate.push({
                                filePath: fileLoc.filePath,
                                range: usage.location,
                                attributeName: attributeName
                            });
                        }
                    }
                    
                    if (locationsToUpdate.length > 0) {
                         vscode.commands.executeCommand('stylelens.executeGlobalRefactor', result.classString, newClassName, locationsToUpdate);
                    } else {
                        vscode.window.showErrorMessage("No se pudieron encontrar las ubicaciones exactas para refactorizar.");
                    }
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
                    background-color: var(--vscode-sideBar-background);
                    padding: 0 10px;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: 1px solid var(--vscode-button-border, transparent);
                    padding: 4px 8px;
                    cursor: pointer;
                    width: 100%;
                    margin-top: 10px;
                }
                button:hover {
                    background-color: var(--vscode-button-hover-background);
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                }
                th, td {
                    padding: 6px;
                    text-align: left;
                    border-bottom: 1px solid var(--vscode-tree-tableColumnsBorderColor);
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
                .file-link {
                    color: var(--vscode-textLink-foreground);
                    cursor: pointer;
                    text-decoration: none;
                }
                .file-link:hover {
                    text-decoration: underline;
                }
                .lines {
                    color: var(--vscode-descriptionForeground);
                    font-size: 0.9em;
                }
                .refactor-btn {
                    width: auto;
                    margin: 0;
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
                let currentAnalysis = [];

                document.getElementById('analyze-button').addEventListener('click', () => {
                    vscodeApi.postMessage({ type: 'analyzeWorkspace' });
                    resultsDiv.innerHTML = '<p>Analizando, por favor espera...</p>';
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.type === 'analysisResult') {
                        currentAnalysis = message.payload;
                        renderResults(currentAnalysis);
                    }
                });

                function renderResults(results) {
                    if (!results || results.length === 0) {
                        resultsDiv.innerHTML = '<p>¡Genial! No se encontraron estilos repetidos en el proyecto.</p>';
                        return;
                    }

                    let html = '<table><thead><tr><th>Combinación</th><th>Usos</th><th>Archivos</th><th>Acción</th></tr></thead><tbody>';
                    for (let i = 0; i < results.length; i++) {
                        const result = results[i];
                        const escapedClassString = result.classString.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        html += \`
                            <tr>
                                <td><code>\${escapedClassString}</code></td>
                                <td>\${result.count}</td>
                                <td>\`;
                        
                        for (const loc of result.locations) {
                            html += \`<div><a class="file-link" href="#" data-filepath="\${loc.filePath}" data-line="\${loc.lines[0]}">\${loc.filePath}</a> <span class="lines">(L: \${loc.lines.join(', ')})</span></div>\`;
                        }
                        html += \`</td><td><button class="refactor-btn" data-index="\${i}">Refactorizar</button></td></tr>\`;
                    }
                    html += '</tbody></table>';
                    resultsDiv.innerHTML = html;
                }

                resultsDiv.addEventListener('click', (event) => {
                    const target = event.target;
                    
                    if (target.tagName === 'A' && target.classList.contains('file-link')) {
                        event.preventDefault();
                        const filePath = target.dataset.filepath;
                        const line = parseInt(target.dataset.line, 10);
                        vscodeApi.postMessage({
                            type: 'openFile',
                            payload: { filePath, line }
                        });
                    }

                    if (target.tagName === 'BUTTON' && target.classList.contains('refactor-btn')) {
                        const index = parseInt(target.dataset.index, 10);
                        const resultToRefactor = currentAnalysis[index];
                        
                        vscodeApi.postMessage({
                            type: 'refactorFromPanel',
                            payload: resultToRefactor
                        });
                    }
                });
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