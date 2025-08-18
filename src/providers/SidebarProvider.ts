import * as vscode from 'vscode';
import { analyzeWorkspaceForWebview, WebviewAnalysisReport, WebviewDuplicateResult, WebviewUndefinedClassResult, WebviewInlineStyleDuplicateResult } from '../analyzer/workspaceAnalyzer';
import { findTargetCssFile, appendToFile } from '../utils/fileUtils';
import { createCssRule } from '../utils/styleUtils';
import { getTranslations, t } from '../i18n';

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

    private getUri(webview: vscode.Webview, ...p: string[]): vscode.Uri {
        return webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, ...p));
    }

    public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
        this._view = webviewView;
        webviewView.webview.options = { 
            enableScripts: true, 
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')] 
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'analyzeWorkspace': {
                    vscode.window.withProgress({ 
                        location: vscode.ProgressLocation.Notification, 
                        title: t('progress.analyzing'), 
                        cancellable: false 
                    }, async (progress) => {
                        progress.report({ increment: 0, message: t('progress.findingFiles') });
                        const report = await analyzeWorkspaceForWebview();
                        progress.report({ increment: 100, message: t('progress.analysisComplete') });
                        this._view?.webview.postMessage({ type: 'analysisResult', payload: report });
                    });
                    break;
                }
                case 'createClassDefinition': {
                    const undefinedClass: WebviewUndefinedClassResult = data.payload;
                    const choice = await vscode.window.showQuickPick([
                        { label: t('quickpick.createManually') }, 
                        { label: t('quickpick.useTemplate') }
                    ], { placeHolder: t('placeholder.createClass').replace('{0}', undefinedClass.className) });
                    if (!choice) return;

                    const targetCssFile = await findTargetCssFile();
                    if (!targetCssFile) { vscode.window.showErrorMessage(t('error.noCssFileFound')); return; }

                    if (choice.label === t('quickpick.createManually')) {
                        const cssRule = `\n\n.${undefinedClass.className} {\n\t\n}`;
                        await appendToFile(targetCssFile, cssRule);
                        const doc = await vscode.workspace.openTextDocument(targetCssFile);
                        const editor = await vscode.window.showTextDocument(doc);
                        const endPosition = doc.lineAt(doc.lineCount - 2).range.end;
                        editor.selection = new vscode.Selection(endPosition, endPosition);
                    } else if (choice.label === t('quickpick.useTemplate')) {
                        const formatChoice = await vscode.window.showQuickPick([
                            { label: t('quickpick.tailwindFormat'), format: 'tailwind' }, 
                            { label: t('quickpick.pureCssFormat'), format: 'css' }
                        ], { placeHolder: t('placeholder.selectFormat') });
                        if (!formatChoice) return;
                        
                        const templateList = TEMPLATES.filter(t => t.type === formatChoice.format);
                        const template = await vscode.window.showQuickPick(templateList, { placeHolder: t('placeholder.selectTemplate') });
                        if (!template) return;

                        let cssRule = template.type === 'tailwind' ? createCssRule(undefinedClass.className, template.content) : `\n\n.${undefinedClass.className} {\n\t${template.content}\n}`;
                        await appendToFile(targetCssFile, cssRule);
                        await vscode.window.showTextDocument(targetCssFile);
                    }
                    break;
                }
                case 'refactorInlineStyle': {
                    const result: WebviewInlineStyleDuplicateResult = data.payload;
                    const newClassName = await vscode.window.showInputBox({ prompt: t('prompt.newClassNameForInline') });
                    if (!newClassName) return;

                    const targetCssFile = await findTargetCssFile();
                    if (!targetCssFile) { vscode.window.showErrorMessage(t('error.noCssFileFound')); return; }

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
                        vscode.window.showErrorMessage(t('error.openFile').replace('{0}', filePath));
                    }
                    break;
                }
                case 'refactorFromPanel': {
                    const result: WebviewDuplicateResult = data.payload;
                    const newClassName = await vscode.window.showInputBox({ prompt: t('prompt.newClassNameForDuplicates') });
                    if (!newClassName) return;

                    const locationsToUpdate = result.fullLocations.map(loc => ({
                        filePath: loc.filePath,
                        range: new vscode.Range(new vscode.Position(loc.location.start.line, loc.location.start.character), new vscode.Position(loc.location.end.line, loc.location.end.character)),
                        attributeName: ''
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
        const codiconsCssUri = this.getUri(webview, 'media', 'codicons', 'codicon.css');
        const codiconsTtfUri = this.getUri(webview, 'media', 'codicons', 'codicon.ttf');
        const translations = getTranslations();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${codiconsCssUri}" rel="stylesheet" />
            <title>${translations['dashboard.welcome.title']}</title>
            <style>
                @font-face {
                    font-family: 'codicon';
                    src: url(${codiconsTtfUri}) format('truetype');
                }
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-sideBar-background);
                    padding: 16px;
                }
                .main-title { font-size: 24px; font-weight: 600; text-align: center; }
                .subtitle { font-size: 14px; color: var(--vscode-descriptionForeground); margin-top: 4px; margin-bottom: 24px; text-align: center; }
                #analyze-button {
                    width: 100%; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground);
                    border: 1px solid var(--vscode-button-border, transparent); padding: 10px; border-radius: 5px;
                    cursor: pointer; font-size: 14px; font-weight: 600; margin-bottom: 32px;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                }
                #analyze-button:hover { background-color: var(--vscode-button-hoverBackground); }
                .summary-section { margin-bottom: 24px; }
                .summary-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
                .summary-header .codicon { font-size: 22px; }
                .summary-header .title { font-size: 16px; font-weight: 600; }
                .icon-warning { color: var(--vscode-editorWarning-foreground); }
                .icon-fire { color: var(--vscode-debugTokenExpression-name); }
                .icon-lightbulb { color: var(--vscode-editorLightBulb-foreground); }
                .tag-group { display: flex; flex-wrap: wrap; gap: 8px; }
                .tag {
                    display: inline-flex; align-items: center; gap: 4px;
                    padding: 4px 10px; border-radius: 16px; font-weight: 500; font-size: 12px;
                }
                .tag .codicon { font-size: 14px; }
                .tag-orange { background-color: rgba(255, 127, 80, 0.2); color: #FF7F50; }
                .tag-yellow { background-color: rgba(255, 204, 0, 0.2); color: var(--vscode-editorWarning-foreground); }
                .tag-green { background-color: rgba(39, 174, 96, 0.2); color: #27ae60; }
                .tag-blue { background-color: rgba(51, 153, 255, 0.2); color: var(--vscode-textLink-foreground); }
                .tag-purple { background-color: rgba(155, 89, 182, 0.2); color: #9b59b6; }
                #view-all-link, #back-to-dashboard-link {
                    display: block; text-align: center; color: var(--vscode-textLink-foreground);
                    cursor: pointer; font-weight: 600; margin-top: 32px;
                }
                #detailed-view { display: none; }
                .tree-item { margin-bottom: 12px; }
                .tree-header {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    user-select: none;
                }
                .tree-header:hover { background-color: var(--vscode-list-hoverBackground); }
                .tree-header .codicon-chevron-right { transition: transform 0.1s ease-in-out; }
                .tree-header .icon { margin: 0 6px; font-size: 18px; }
                .tree-header .title { font-weight: 600; }
                .tree-header .count-badge {
                    margin-left: auto;
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    font-size: 12px;
                    font-weight: 600;
                    padding: 2px 8px;
                    border-radius: 10px;
                }
                .tree-content {
                    display: none;
                    padding-left: 20px;
                    border-left: 1px solid var(--vscode-tree-inactiveIndentGuidesStroke);
                    margin-left: 8px;
                }
                .tree-item.open > .tree-content { display: block; }
                .tree-item.open > .tree-header .codicon-chevron-right { transform: rotate(90deg); }
                .result-group { padding: 8px 0; border-bottom: 1px solid var(--vscode-tree-tableColumnsBorderColor); }
                .result-group:last-child { border-bottom: none; }
                .result-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 4px;
                }
                .result-header code {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 2px 6px;
                    border-radius: 3px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 150px;
                }
                .action-btn {
                    background-color: transparent;
                    color: var(--vscode-button-secondaryForeground);
                    border: 1px solid var(--vscode-button-secondaryBackground);
                    padding: 2px 8px;
                    cursor: pointer;
                    font-size: 12px;
                    border-radius: 3px;
                }
                .action-btn:hover { background-color: var(--vscode-button-secondaryHoverBackground); }
                .file-link {
                    display: block;
                    padding-left: 4px;
                    font-size: 12px;
                    color: var(--vscode-textLink-foreground);
                    cursor: pointer;
                    text-decoration: none;
                    margin-bottom: 2px;
                }
                .file-link:hover { text-decoration: underline; }
                .lines { color: var(--vscode-descriptionForeground); }
            </style>
        </head>
        <body>
            <div id="main-content">
                <h1 class="main-title">${translations['dashboard.welcome.title']}</h1>
                <p class="subtitle">${translations['dashboard.welcome.subtitle']}</p>
                <button id="analyze-button"><i class="codicon codicon-sync"></i> ${translations['dashboard.button.analyze']}</button>
                <div id="dashboard-view"></div>
                <div id="detailed-view">
                    <a href="#" id="back-to-dashboard-link">&larr; ${translations['dashboard.back']}</a>
                    <div id="full-report-container"></div>
                </div>
            </div>
            <script nonce="${nonce}">
                const vscodeApi = acquireVsCodeApi();
                const i18n = ${JSON.stringify(translations)};
                const dashboardView = document.getElementById('dashboard-view');
                const detailedView = document.getElementById('detailed-view');
                const fullReportContainer = document.getElementById('full-report-container');
                let currentReport = {};

                document.getElementById('analyze-button').addEventListener('click', () => {
                    vscodeApi.postMessage({ type: 'analyzeWorkspace' });
                    dashboardView.innerHTML = \`<p>\${i18n['dashboard.analyzing']}</p>\`;
                    detailedView.style.display = 'none';
                    dashboardView.style.display = 'block';
                });

                window.addEventListener('message', event => {
                    if (event.data.type === 'analysisResult') {
                        currentReport = event.data.payload;
                        renderDashboard(currentReport);
                        renderFullReport(currentReport);
                        dashboardView.style.display = 'block';
                        detailedView.style.display = 'none';
                    }
                });

                document.getElementById('back-to-dashboard-link').addEventListener('click', (e) => {
                    e.preventDefault();
                    detailedView.style.display = 'none';
                    dashboardView.style.display = 'block';
                });

                function renderDashboard(report) {
                    if (!report || !report.duplicateSummary) {
                        dashboardView.innerHTML = \`<p>\${i18n['dashboard.noProblems']}</p>\`;
                        return;
                    }

                    const { duplicateSummary, classHeat, recommendations } = report;
                    const hasDuplicates = duplicateSummary.critical > 0 || duplicateSummary.warning > 0 || duplicateSummary.normal > 0;
                    const hasHeat = classHeat.hot.length > 0 || classHeat.warm.length > 0 || classHeat.normal.length > 0;

                    dashboardView.innerHTML = \`
                        <div class="summary-section">
                            <div class="summary-header">
                                <i class="codicon codicon-copy icon icon-warning"></i>
                                <span class="title">\${i18n['dashboard.duplicates.title']}</span>
                            </div>
                            <div class="tag-group">
                                \${hasDuplicates ? \`
                                    \${duplicateSummary.critical > 0 ? \`<div class="tag tag-orange"><i class="codicon codicon-alert"></i> \${duplicateSummary.critical} \${i18n['dashboard.duplicates.critical']}</div>\` : ''}
                                    \${duplicateSummary.warning > 0 ? \`<div class="tag tag-yellow"><i class="codicon codicon-info"></i> \${duplicateSummary.warning} \${i18n['dashboard.duplicates.warning']}</div>\` : ''}
                                    \${duplicateSummary.normal > 0 ? \`<div class="tag tag-blue"><i class="codicon codicon-issues"></i> \${duplicateSummary.normal} \${i18n['dashboard.duplicates.minor']}</div>\` : ''}
                                \` : \`<p style="font-size:12px; color: var(--vscode-descriptionForeground);">\${i18n['dashboard.duplicates.none']}</p>\`}
                            </div>
                        </div>

                        <div class="summary-section">
                            <div class="summary-header">
                                <i class="codicon codicon-flame icon icon-fire"></i>
                                <span class="title">\${i18n['dashboard.classHeat.title']}</span>
                            </div>
                            <div class="tag-group">
                                \${hasHeat ? \`
                                    \${classHeat.hot.length > 0 ? \`<div class="tag tag-orange"><i class="codicon codicon-arrow-up"></i> \${classHeat.hot.length} \${i18n['dashboard.classHeat.hot']}</div>\` : ''}
                                    \${classHeat.warm.length > 0 ? \`<div class="tag tag-yellow"><i class="codicon codicon-arrow-right"></i> \${classHeat.warm.length} \${i18n['dashboard.classHeat.warm']}</div>\` : ''}
                                    \${classHeat.normal.length > 0 ? \`<div class="tag tag-green"><i class="codicon codicon-arrow-down"></i> \${classHeat.normal.length} \${i18n['dashboard.classHeat.normal']}</div>\` : ''}
                                \` : \`<p style="font-size:12px; color: var(--vscode-descriptionForeground);">\${i18n['dashboard.classHeat.noData']}</p>\`}
                            </div>
                        </div>

                        <div class="summary-section">
                            <div class="summary-header">
                                <i class="codicon codicon-lightbulb icon icon-lightbulb"></i>
                                <span class="title">\${i18n['dashboard.recommendations.title']}</span>
                            </div>
                            <div class="tag-group">
                                \${recommendations.length > 0 ? \`<div class="tag tag-purple"><i class="codicon codicon-tools"></i> \${recommendations.length} \${i18n['dashboard.recommendations.refactors']}</div>\` : \`<p style="font-size:12px; color: var(--vscode-descriptionForeground);">\${i18n['dashboard.recommendations.none']}</p>\`}
                            </div>
                        </div>

                        <a href="#" id="view-all-link">\${i18n['dashboard.viewFullReport']}</a>
                    \`;
                    
                    document.getElementById('view-all-link').addEventListener('click', (e) => {
                        e.preventDefault();
                        dashboardView.style.display = 'none';
                        detailedView.style.display = 'block';
                    });
                }

                function renderFullReport(report) {
                    let treeHtml = '<div class="tree-container">';
                    const { duplicates, inlineStyleDuplicates, undefinedClasses } = report;

                    if (duplicates && duplicates.length > 0) {
                        treeHtml += renderTreeSection('duplicates', i18n['report.title.duplicates'], 'codicon-copy', duplicates, (item, i) => \`
                            <div class="result-header">
                                <code title="\${escapeHtml(item.classString)}">\${escapeHtml(item.classString)}</code>
                                <button class="action-btn" data-action="refactor" data-index="\${i}">\${i18n['report.button.refactor']}</button>
                            </div>
                            \${renderFileLinks(item.fullLocations)}
                        \`);
                    }
                    if (inlineStyleDuplicates && inlineStyleDuplicates.length > 0) {
                        treeHtml += renderTreeSection('inlineStyles', i18n['report.title.inlineStyles'], 'codicon-paintcan', inlineStyleDuplicates, (item, i) => \`
                            <div class="result-header">
                                <code title="\${escapeHtml(item.styleString)}">\${escapeHtml(item.styleString)}</code>
                                <button class="action-btn" data-action="refactor-inline" data-index="\${i}">\${i18n['report.button.extract']}</button>
                            </div>
                            \${renderFileLinks(item.fullLocations)}
                        \`);
                    }
                    if (undefinedClasses && undefinedClasses.length > 0) {
                        treeHtml += renderTreeSection('undefined', i18n['report.title.undefinedClasses'], 'codicon-ghost', undefinedClasses, (item, i) => \`
                            <div class="result-header">
                                <code>\${escapeHtml(item.className)}</code>
                                <button class="action-btn" data-action="create-class" data-index="\${i}">\${i18n['report.button.createStyle']}</button>
                            </div>
                            <a class="file-link" href="#" data-filepath="\${item.filePath}" data-line="\${item.location.start.line + 1}">\${item.filePath} <span class="lines">(L: \${item.location.start.line + 1})</span></a>
                        \`);
                    }
                    treeHtml += '</div>';
                    fullReportContainer.innerHTML = treeHtml;
                }

                function renderTreeSection(id, title, icon, items, renderItemFn) {
                    return \`
                        <div class="tree-item" id="tree-\${id}">
                            <div class="tree-header">
                                <i class="codicon codicon-chevron-right"></i>
                                <i class="codicon \${icon} icon"></i>
                                <span class="title">\${title}</span>
                                <span class="count-badge">\${items.length}</span>
                            </div>
                            <div class="tree-content">
                                \${items.map((item, i) => \`<div class="result-group">\${renderItemFn(item, i)}</div>\`).join('')}
                            </div>
                        </div>
                    \`;
                }

                function renderFileLinks(locations) {
                    const map = new Map();
                    locations.forEach(loc => {
                        if (!map.has(loc.filePath)) map.set(loc.filePath, []);
                        map.get(loc.filePath).push(loc.location.start.line + 1);
                    });
                    let links = '';
                    map.forEach((lines, filePath) => {
                        links += \`<a class="file-link" href="#" data-filepath="\${filePath}" data-line="\${lines[0]}">\${filePath} <span class="lines">(L: \${lines.sort((a,b)=>a-b).join(', ')})</span></a>\`;
                    });
                    return links;
                }

                function escapeHtml(str) { return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
                
                detailedView.addEventListener('click', (event) => {
                    const target = event.target;
                    const treeHeader = target.closest('.tree-header');
                    if (treeHeader) {
                        treeHeader.parentElement.classList.toggle('open');
                        return;
                    }
                    
                    const fileLink = target.closest('.file-link');
                    if (fileLink) {
                        event.preventDefault();
                        vscodeApi.postMessage({ type: 'openFile', payload: { filePath: fileLink.dataset.filepath, line: parseInt(fileLink.dataset.line, 10) } });
                        return;
                    }

                    const actionButton = target.closest('.action-btn');
                    if (actionButton) {
                        const action = actionButton.dataset.action;
                        const index = parseInt(actionButton.dataset.index, 10);
                        
                        if (action === 'refactor') vscodeApi.postMessage({ type: 'refactorFromPanel', payload: currentReport.duplicates[index] });
                        else if (action === 'refactor-inline') vscodeApi.postMessage({ type: 'refactorInlineStyle', payload: currentReport.inlineStyleDuplicates[index] });
                        else if (action === 'create-class') vscodeApi.postMessage({ type: 'createClassDefinition', payload: currentReport.undefinedClasses[index] });
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