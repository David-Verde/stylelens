import * as vscode from 'vscode';

export async function getAllDefinedCssClasses(): Promise<Set<string>> {
    const cssFiles = await vscode.workspace.findFiles('**/*.css', '**/node_modules/**');
    const definedClasses = new Set<string>();
    
    const classRegex = /\.([a-zA-Z0-9_-]+)/g;

    for (const file of cssFiles) {
        try {
            const document = await vscode.workspace.openTextDocument(file);
            const content = document.getText();
            let match;
            while ((match = classRegex.exec(content)) !== null) {
                definedClasses.add(match[1]);
            }
        } catch (error) {
            console.error(`StyleLens: Error reading CSS file ${file.fsPath}`, error);
        }
    }

    return definedClasses;
}