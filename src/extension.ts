import * as vscode from 'vscode';
import { StyleLensProvider } from './providers/StyleLensProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('¡Felicidades, la extensión "stylelens" está activa!');

    const selector = [
        { language: 'javascriptreact', scheme: 'file' },
        { language: 'typescriptreact', scheme: 'file' }
    ];
    
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(selector, new StyleLensProvider())
    );

    let refactorCommand = vscode.commands.registerCommand('stylelens.refactorStyleAction', (range: vscode.Range, uri: vscode.Uri) => {
        vscode.window.showInformationMessage('¡Acción de refactorización activada!');
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