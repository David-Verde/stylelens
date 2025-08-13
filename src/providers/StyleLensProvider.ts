import * as vscode from 'vscode';
import { findDuplicateClasses as findDuplicateClassesInJsx, StyleUsage } from '../analyzer/jsxParser';
import { findDuplicateClassesInVue } from '../analyzer/vueParser';
import { findDuplicateClassesInSvelte } from '../analyzer/svelteParser';

function groupDuplicates(usages: StyleUsage[]): Map<string, vscode.Range[]> {
    const groups = new Map<string, vscode.Range[]>();
    for (const usage of usages) {
        if (!groups.has(usage.classString)) {
            groups.set(usage.classString, []);
        }
        groups.get(usage.classString)!.push(usage.location);
    }
    return groups;
}

export class StyleLensProvider implements vscode.CodeLensProvider {
    
    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
        if (document.isClosed || document.lineCount > 2000) {
            return [];
        }

        let duplicateStyles: StyleUsage[] = [];

        if (document.languageId === 'svelte') {
              duplicateStyles = await findDuplicateClassesInSvelte(document); 
        } else if (document.languageId === 'vue') {
            duplicateStyles = findDuplicateClassesInVue(document.getText());
        } else if (document.languageId === 'javascriptreact' || document.languageId === 'typescriptreact') {
            duplicateStyles = findDuplicateClassesInJsx(document.getText());
        }

        if (duplicateStyles.length === 0) {
            return [];
        }

        const groupedDuplicates = groupDuplicates(duplicateStyles);
        const codeLenses: vscode.CodeLens[] = [];

        groupedDuplicates.forEach((locations, classString) => {
            const firstLocation = locations[0];
            const lens = new vscode.CodeLens(firstLocation);
            
            const attributeName = (document.languageId === 'vue' || document.languageId === 'svelte') ? 'class' : 'className';

            lens.command = {
                title: `StyleLens: ⚡️ ${locations.length} veces repetido. ¡Refactorizar!`,
                command: "stylelens.refactorStyleAction",
                arguments: [locations, document.uri, attributeName],
            };
            codeLenses.push(lens);
        });

        return codeLenses;
    }
}