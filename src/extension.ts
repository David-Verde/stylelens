import * as vscode from 'vscode';
import { StyleLensProvider } from './providers/StyleLensProvider';
import { createCssRule } from './utils/styleUtils';
import { findTargetCssFile, appendToFile } from './utils/fileUtils';

export function activate(context: vscode.ExtensionContext) {
    console.log('¡Felicidades, la extensión "stylelens" está activa!');

    const selector = [
        { language: 'javascriptreact', scheme: 'file' },
        { language: 'typescriptreact', scheme: 'file' }
    ];
    
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(selector, new StyleLensProvider())
    );

    let refactorCommand = vscode.commands.registerCommand('stylelens.refactorStyleAction', async (range: vscode.Range, uri: vscode.Uri) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.toString() !== uri.toString()) {
            return;
        }

        const originalClassAttribute = editor.document.getText(range);
        const match = originalClassAttribute.match(/["'](.*?)["']/);
        if (!match || !match[1]) {
            vscode.window.showErrorMessage('No se pudieron extraer las clases.');
            return;
        }
        const utilityClasses = match[1];

        const newClassName = await vscode.window.showInputBox({
            prompt: 'Introduce el nombre para la nueva clase CSS (sin el punto)',
            placeHolder: 'ej: card-header, primary-button',
            validateInput: text => {
                return /^[a-z0-9_-]+$/.test(text) ? null : 'Nombre inválido. Usa solo letras minúsculas, números, guiones y guiones bajos.';
            }
        });

        if (!newClassName) {
            return;
        }

        const targetCssFileUri = await findTargetCssFile();
        if (!targetCssFileUri) {
            vscode.window.showErrorMessage('No se encontró un archivo CSS/SCSS global (ej: global.css, index.css). Por favor, crea uno.');
            return;
        }

        const cssRule = createCssRule(newClassName, utilityClasses);
        await appendToFile(targetCssFileUri, cssRule);

        const edit = new vscode.WorkspaceEdit();
        const newAttributeText = `className="${newClassName}"`;
        edit.replace(uri, range, newAttributeText);
        await vscode.workspace.applyEdit(edit);
        
        vscode.window.showInformationMessage(`Clase .${newClassName} creada y aplicada con éxito.`);
        
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