import * as vscode from 'vscode';
import { StyleLensProvider } from './providers/StyleLensProvider';
import { SidebarProvider } from './providers/SidebarProvider';
import { createCssRule } from './utils/styleUtils';
import { findTargetCssFile, appendToFile } from './utils/fileUtils';

export function activate(context: vscode.ExtensionContext) {
    console.log('¡Felicidades, la extensión "stylelens" está activa!');

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

    let refactorCommand = vscode.commands.registerCommand('stylelens.refactorStyleAction', async (locations: vscode.Range[], uri: vscode.Uri, attributeName: string) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.toString() !== uri.toString() || locations.length === 0) {
            return;
        }

        const firstLocation = locations[0];
        const originalClassAttribute = editor.document.getText(firstLocation);
        const match = originalClassAttribute.match(/["'](.*?)["']/);
        if (!match || !match[1]) {
            vscode.window.showErrorMessage('No se pudieron extraer las clases.');
            return;
        }
        const utilityClasses = match[1];

        const newClassName = await vscode.window.showInputBox({
            prompt: `Introduce un nombre para la nueva clase que reemplazará ${locations.length} ocurrencias.`,
            placeHolder: 'ej: card-layout, primary-button',
            validateInput: text => /^[a-z0-9_-]+$/.test(text) ? null : 'Nombre inválido.',
        });

        if (!newClassName) {
            return;
        }

        const targetCssFileUri = await findTargetCssFile();
        if (!targetCssFileUri) {
            vscode.window.showErrorMessage('No se encontró un archivo CSS/SCSS global.');
            return;
        }

        const cssRule = createCssRule(newClassName, utilityClasses);
        await appendToFile(targetCssFileUri, cssRule);

        const edit = new vscode.WorkspaceEdit();
        const newAttributeText = `${attributeName}="${newClassName}"`;

        for (const location of locations) {
            edit.replace(uri, location, newAttributeText);
        }
        
        await vscode.workspace.applyEdit(edit);
        
        vscode.window.showInformationMessage(`Clase .${newClassName} creada y aplicada con éxito en ${locations.length} lugares.`);
        
        const doc = await vscode.workspace.openTextDocument(targetCssFileUri);
        await vscode.window.showTextDocument(doc);
    });
    
    context.subscriptions.push(refactorCommand);

    let analyzeCommand = vscode.commands.registerCommand('stylelens.analyzeWorkspaceStyles', () => {
        const activeEditor = vscode.window.activeTextEditor;

        if (!activeEditor) {
            vscode.window.showWarningMessage('No hay un editor de texto activo.');
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
            outputChannel.appendLine(`Análisis de ${document.fileName}:\n`);
            outputChannel.appendLine('--- Clases/Combinaciones Repetidas ---');
            duplicates.forEach(([classString, count]) => {
                outputChannel.appendLine(`[${count} veces] ${classString}`);
            });
        } else {
            outputChannel.appendLine(`Análisis de ${document.fileName}:`);
            outputChannel.appendLine('¡Genial! No se encontraron clases duplicadas en este archivo.');
        }

        outputChannel.show();
    });

    context.subscriptions.push(analyzeCommand);
}

export function deactivate() {}