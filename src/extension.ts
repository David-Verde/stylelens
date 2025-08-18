import * as vscode from 'vscode';
import { StyleLensProvider } from './providers/StyleLensProvider';
import { SidebarProvider } from './providers/SidebarProvider';
import { createCssRule } from './utils/styleUtils';
import { findTargetCssFile, appendToFile } from './utils/fileUtils';
import { initializeUtilityClassSet } from './analyzer/workspaceAnalyzer';
import { initialize as initializeI18n, t } from './i18n';

export function activate(context: vscode.ExtensionContext) {
    initializeI18n(context);
    initializeUtilityClassSet(context);

    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
    );

    const selector = [
        { language: 'javascriptreact', scheme: 'file' },
        { language: 'typescriptreact', scheme: 'file' },
        { language: 'vue', scheme: 'file' },
        { language: 'svelte', scheme: 'file' }
    ];

    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(selector, new StyleLensProvider())
    );

    const globalRefactorCommand = vscode.commands.registerCommand(
        'stylelens.executeGlobalRefactor',
        async (utilityClasses: string, newClassName: string, locationsToUpdate: { filePath: string; range: vscode.Range; attributeName: string }[]) => {

            const targetCssFileUri = await findTargetCssFile();
            if (!targetCssFileUri) {
                vscode.window.showErrorMessage(t('error.noGlobalCssFile'));
                return;
            }

            const cssRule = createCssRule(newClassName, utilityClasses);
            await appendToFile(targetCssFileUri, cssRule);

            const edit = new vscode.WorkspaceEdit();

            for (const loc of locationsToUpdate) {
                const fileUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, loc.filePath);
                const newAttributeText = `${loc.attributeName}="${newClassName}"`;
                edit.replace(fileUri, loc.range, newAttributeText);
            }

            await vscode.workspace.applyEdit(edit);

            vscode.window.showInformationMessage(
                t('info.refactorSuccess')
                    .replace('{0}', newClassName)
                    .replace('{1}', locationsToUpdate.length.toString())
            );

            const doc = await vscode.workspace.openTextDocument(targetCssFileUri);
            await vscode.window.showTextDocument(doc);
        }
    );
    context.subscriptions.push(globalRefactorCommand);

    let refactorCommand = vscode.commands.registerCommand('stylelens.refactorStyleAction', async (locations: vscode.Range[], uri: vscode.Uri, attributeName: string) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.toString() !== uri.toString() || locations.length === 0) {
            return;
        }

        const firstLocation = locations[0];
        const originalClassAttribute = editor.document.getText(firstLocation);
        const match = originalClassAttribute.match(/["'](.*?)["']/);
        if (!match || !match[1]) return;
        const utilityClasses = match[1];

        const newClassName = await vscode.window.showInputBox({
            prompt: t('prompt.newClassName').replace('{0}', locations.length.toString()),
            placeHolder: t('placeholder.newClassName'),
            validateInput: text => /^[a-z0-9_-]+$/.test(text) ? null : t('validation.invalidClassName'),
        });

        if (!newClassName) return;

        const locationsToUpdate = locations.map(range => ({
            filePath: vscode.workspace.asRelativePath(uri),
            range: range,
            attributeName: attributeName
        }));

        vscode.commands.executeCommand('stylelens.executeGlobalRefactor', utilityClasses, newClassName, locationsToUpdate);
    });
    context.subscriptions.push(refactorCommand);

    let analyzeCommand = vscode.commands.registerCommand('stylelens.analyzeWorkspaceStyles', () => {
        const activeEditor = vscode.window.activeTextEditor;

        if (!activeEditor) {
            vscode.window.showWarningMessage(t('warning.noActiveEditor'));
            return;
        }

        const document = activeEditor.document;
        const fileContent = document.getText();
        const classRegex = /(class|className)=["'](.*?)["']/g;
        let match;
        const classCounts: Map<string, number> = new Map();

        while ((match = classRegex.exec(fileContent)) !== null) {
            const classString = match[2].trim();
            if (classString) {
                const sortedClassString = classString.split(/\s+/).sort().join(' ');
                const count = classCounts.get(sortedClassString) || 0;
                classCounts.set(sortedClassString, count + 1);
            }
        }

        const duplicates = Array.from(classCounts.entries()).filter(([key, value]) => value > 1);
        const outputChannel = vscode.window.createOutputChannel('StyleLens Results');
        outputChannel.clear();

        if (duplicates.length > 0) {
            outputChannel.appendLine(`${t('output.analysisOf')} ${document.fileName}:\n`);
            outputChannel.appendLine(`--- ${t('output.repeatedClassesHeader')} ---`);
            duplicates.forEach(([classString, count]) => {
                outputChannel.appendLine(`[${count} ${t('output.times')}] ${classString}`);
            });
        } else {
            outputChannel.appendLine(`${t('output.analysisOf')} ${document.fileName}:`);
            outputChannel.appendLine(t('output.noDuplicatesFound'));
        }

        outputChannel.show();
    });

    context.subscriptions.push(analyzeCommand);
}

export function deactivate() { }