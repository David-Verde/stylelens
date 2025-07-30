import * as vscode from 'vscode';
import { findDuplicateClasses } from '../analyzer/jsxParser';

export class StyleLensProvider implements vscode.CodeLensProvider {
    

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        
 
        if (document.isClosed || document.lineCount > 2000) {
            return [];
        }

        const fileContent = document.getText();
        const duplicateStyles = findDuplicateClasses(fileContent);
        
        const codeLenses: vscode.CodeLens[] = [];

        for (const style of duplicateStyles) {
        
            const lens = new vscode.CodeLens(style.location);
            
        
            lens.command = {
                title: "StyleLens: ⚡️ Estilo repetido. ¡Refactorizar!",
                command: "stylelens.refactorStyleAction",
                arguments: [style.location, document.uri], 
            };
            codeLenses.push(lens);
        }

        return codeLenses;
    }
}