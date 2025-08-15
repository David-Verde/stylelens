import * as vscode from 'vscode';
import { analyzeWorkspaceForWebview, WebviewAnalysisReport, WebviewDuplicateResult, WebviewUndefinedClassResult, WebviewInlineStyleDuplicateResult } from '../analyzer/workspaceAnalyzer';
import { findTargetCssFile, appendToFile } from '../utils/fileUtils';
import { createCssRule } from '../utils/styleUtils';

interface Template {
    label: string;
    description: string;
    content: string;
    type: 'tailwind' | 'css';
}

const TEMPLATES: Template[] = [
    { label: 'Input (Tailwind)', description: 'Campo de texto estándar.', content: 'border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500', type: 'tailwind' },
    { label: 'Input (CSS Puro)', description: 'Campo de texto estándar.', content: 'border: 1px solid #ccc;\n\tborder-radius: 4px;\n\tpadding: 8px 12px;\n\tfont-size: 16px;', type: 'css' },
    { label: 'Botón Primario (Tailwind)', description: 'Botón principal.', content: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded', type: 'tailwind' },
    { label: 'Botón Primario (CSS Puro)', description: 'Botón principal.', content: 'background-color: #007bff;\n\tcolor: white;\n\tborder: none;\n\tborder-radius: 4px;\n\tpadding: 10px 16px;\n\tfont-weight: bold;\n\tcursor: pointer;', type: 'css' },
    { label: 'Tarjeta (Card) (Tailwind)', description: 'Contenedor con sombra.', content: 'bg-white border rounded-lg p-4 shadow', type: 'tailwind' },
    { label: 'Tarjeta (Card) (CSS Puro)', description: 'Contenedor con sombra.', content: 'background-color: white;\n\tborder: 1px solid #ddd;\n\tborder-radius: 8px;\n\tpadding: 16px;\n\tbox-shadow: 0 2px 4px rgba(0,0,0,0.1);', type: 'css' },
];

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'stylelens.mainView';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'analyzeWorkspace': {
                    vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "StyleLens: Analizando...", cancellable: false }, async (progress) => {
                        progress.report({ increment: 0, message: "Buscando archivos..." });
                        const report = await analyzeWorkspaceForWebview();
                        progress.report({ increment: 100, message: "Análisis completado." });
                        this._view?.webview.postMessage({ type: 'analysisResult', payload: report });
                    });
                    break;
                }
                case 'createClassDefinition': {
                    const undefinedClass: WebviewUndefinedClassResult = data.payload;
                    const choice = await vscode.window.showQuickPick([{ label: 'Crear manualmente' }, { label: 'Usar una plantilla' }], { placeHolder: `Crear ".${undefinedClass.className}"` });
                    if (!choice) return;

                    const targetCssFile = await findTargetCssFile();
                    if (!targetCssFile) { vscode.window.showErrorMessage('No se encontró archivo CSS global.'); return; }

                    if (choice.label === 'Crear manualmente') {
                        const cssRule = `\n\n.${undefinedClass.className} {\n\t\n}`;
                        await appendToFile(targetCssFile, cssRule);
                        const doc = await vscode.workspace.openTextDocument(targetCssFile);
                        const editor = await vscode.window.showTextDocument(doc);
                        const endPosition = doc.lineAt(doc.lineCount - 2).range.end;
                        editor.selection = new vscode.Selection(endPosition, endPosition);
                    } else if (choice.label === 'Usar una plantilla') {
                        const formatChoice = await vscode.window.showQuickPick([{ label: 'Tailwind CSS (@apply)', format: 'tailwind' }, { label: 'CSS Puro', format: 'css' }], { placeHolder: 'Selecciona formato' });
                        if (!formatChoice) return;
                        
                        const templateList = TEMPLATES.filter(t => t.type === formatChoice.format);
                        const template = await vscode.window.showQuickPick(templateList, { placeHolder: 'Selecciona una plantilla' });
                        if (!template) return;

                        let cssRule = template.type === 'tailwind' ? createCssRule(undefinedClass.className, template.content) : `\n\n.${undefinedClass.className} {\n\t${template.content}\n}`;
                        await appendToFile(targetCssFile, cssRule);
                        await vscode.window.showTextDocument(targetCssFile);
                    }
                    break;
                }
                case 'refactorInlineStyle': {
                    const result: WebviewInlineStyleDuplicateResult = data.payload;
                    const newClassName = await vscode.window.showInputBox({ prompt: `Nombre para la nueva clase:` });
                    if (!newClassName) return;

                    const targetCssFile = await findTargetCssFile();
                    if (!targetCssFile) { vscode.window.showErrorMessage('No se encontró archivo CSS global.'); return; }

                    const cssRule = `\n\n.${newClassName} {\n\t${result.styleString.replace(/; /g, ';\n\t')}\n}`;
                    await appendToFile(targetCssFile, cssRule);

                    const edit = new vscode.WorkspaceEdit();
                    for (const loc of result.fullLocations) {
                        const fileUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, loc.filePath);
                        const doc = await vscode.workspace.openTextDocument(fileUri);
                        const attributeName = (doc.languageId === 'vue' || doc.languageId === 'svelte') ? 'class' : 'className';
                        const range = new vscode.Range(new vscode.Position(loc.location.start.line, loc.location.start.character), new vscode.Position(loc.location.end.line, loc.location.end.character));
                        edit.replace(fileUri, range, `${attributeName}="${newClassName}"`);
                    }
                    await vscode.workspace.applyEdit(edit);
                    vscode.window.showTextDocument(targetCssFile);
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
                case 'refactorFromPanel': {
                    const result: WebviewDuplicateResult = data.payload;
                    const newClassName = await vscode.window.showInputBox({ prompt: `Nombre para la nueva clase:` });
                    if (!newClassName) return;

                    const locationsToUpdate = result.fullLocations.map(loc => ({
                        filePath: loc.filePath,
                        range: new vscode.Range(new vscode.Position(loc.location.start.line, loc.location.start.character), new vscode.Position(loc.location.end.line, loc.location.end.character)),
                        attributeName: '' // Will be determined in the command
                    }));

                    const firstLoc = locationsToUpdate[0];
                    if(firstLoc) {
                        const fileUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, firstLoc.filePath);
                        const document = await vscode.workspace.openTextDocument(fileUri);
                        const attributeName = (document.languageId === 'vue' || document.languageId === 'svelte') ? 'class' : 'className';
                        locationsToUpdate.forEach(loc => loc.attributeName = attributeName);
                        vscode.commands.executeCommand('stylelens.executeGlobalRefactor', result.classString, newClassName, locationsToUpdate);
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
                body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background-color: var(--vscode-sideBar-background); padding: 0 10px; }
                h2 { margin-top: 20px; border-bottom: 1px solid var(--vscode-tree-tableColumnsBorderColor); padding-bottom: 5px; }
                button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 8px; cursor: pointer; width: 100%; margin-top: 10px; }
                button:hover { background-color: var(--vscode-button-hover-background); }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 6px; text-align: left; border-bottom: 1px solid var(--vscode-tree-tableColumnsBorderColor); }
                code { background-color: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px; }
                .file-link { color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: none; }
                .file-link:hover { text-decoration: underline; }
                .lines { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
                .action-btn { width: auto; margin: 0; }
            </style>
        </head>
        <body>
            <h1>Panel de StyleLens</h1>
            <button id="analyze-button">Analizar Workspace</button>
            <div id="results"></div>

            <script nonce="${nonce}">
                const vscodeApi = acquireVsCodeApi();
                const resultsDiv = document.getElementById('results');
                let currentReport = { duplicates: [], inlineStyleDuplicates: [], undefinedClasses: [] };

                document.getElementById('analyze-button').addEventListener('click', () => {
                    vscodeApi.postMessage({ type: 'analyzeWorkspace' });
                    resultsDiv.innerHTML = '<p>Analizando...</p>';
                });

                window.addEventListener('message', event => {
                    if (event.data.type === 'analysisResult') {
                        currentReport = event.data.payload;
                        renderReport(currentReport);
                    }
                });

                function renderReport(report) {
                    let html = '';
                    const hasDupes = report.duplicates && report.duplicates.length > 0;
                    const hasInlineDupes = report.inlineStyleDuplicates && report.inlineStyleDuplicates.length > 0;
                    const hasUndefined = report.undefinedClasses && report.undefinedClasses.length > 0;

                    if (!hasDupes && !hasInlineDupes && !hasUndefined) {
                        resultsDiv.innerHTML = '<p>¡Genial! No se encontraron problemas de estilos.</p>';
                        return;
                    }

                    if (hasDupes) {
                        html += '<h2>Estilos Repetidos (className)</h2>';
                        html += '<table><thead><tr><th>Combinación</th><th>Usos</th><th>Archivos</th><th>Acción</th></tr></thead><tbody>';
                        report.duplicates.forEach((result, i) => {
                            html += \`<tr><td><code>\${result.classString}</code></td><td>\${result.count}</td><td>\${renderFileLinks(result.fullLocations)}</td><td><button class="action-btn" data-action="refactor" data-index="\${i}">Refactorizar</button></td></tr>\`;
                        });
                        html += '</tbody></table>';
                    }
                    
                    if (hasInlineDupes) {
                        html += '<h2>Estilos en Línea Repetidos (style)</h2>';
                        html += '<table><thead><tr><th>Estilos</th><th>Usos</th><th>Archivos</th><th>Acción</th></tr></thead><tbody>';
                        report.inlineStyleDuplicates.forEach((result, i) => {
                            html += \`<tr><td><code>\${result.styleString}</code></td><td>\${result.count}</td><td>\${renderFileLinks(result.fullLocations)}</td><td><button class="action-btn" data-action="refactor-inline" data-index="\${i}">Refactorizar</button></td></tr>\`;
                        });
                        html += '</tbody></table>';
                    }

                    if (hasUndefined) {
                        html += '<h2>Clases sin Definir</h2>';
                        html += '<table><thead><tr><th>Clase</th><th>Archivo</th><th>Acción</th></tr></thead><tbody>';
                        report.undefinedClasses.forEach((result, i) => {
                            const line = result.location.start.line + 1;
                            html += \`<tr><td><code>\${result.className}</code></td><td><a class="file-link" href="#" data-filepath="\${result.filePath}" data-line="\${line}">\${result.filePath}</a></td><td><button class="action-btn" data-action="create-class" data-index="\${i}">Crear Estilos</button></td></tr>\`;
                        });
                        html += '</tbody></table>';
                    }

                    resultsDiv.innerHTML = html;
                }

                function renderFileLinks(locations) {
                    const map = new Map();
                    locations.forEach(loc => {
                        if (!map.has(loc.filePath)) map.set(loc.filePath, []);
                        map.get(loc.filePath).push(loc.location.start.line + 1);
                    });
                    let links = '';
                    map.forEach((lines, filePath) => {
                        links += \`<div><a class="file-link" href="#" data-filepath="\${filePath}" data-line="\${lines[0]}">\${filePath}</a> <span class="lines">(L: \${lines.sort((a,b)=>a-b).join(', ')})</span></div>\`;
                    });
                    return links;
                }

                resultsDiv.addEventListener('click', (event) => {
                    const target = event.target;
                    
                    if (target.tagName === 'A' && target.classList.contains('file-link')) {
                        event.preventDefault();
                        const action = target.dataset.action;
                        const index = parseInt(target.dataset.index, 10);
                        vscodeApi.postMessage({ type: 'openFile', payload: { filePath: target.dataset.filepath, line: parseInt(target.dataset.line, 10) } });
                    }

                    if (target.tagName === 'BUTTON' && target.classList.contains('action-btn')) {
                        const action = target.dataset.action;
                        const index = parseInt(target.dataset.index, 10);
                        
                        if (action === 'refactor') {
                            vscodeApi.postMessage({ type: 'refactorFromPanel', payload: currentReport.duplicates[index] });
                        } else if (action === 'refactor-inline') {
                            vscodeApi.postMessage({ type: 'refactorInlineStyle', payload: currentReport.inlineStyleDuplicates[index] });
                        } else if (action === 'create-class') {
                            vscodeApi.postMessage({ type: 'createClassDefinition', payload: currentReport.undefinedClasses[index] });
                        }
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