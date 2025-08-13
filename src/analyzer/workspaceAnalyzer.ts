import * as vscode from 'vscode';
import { findDuplicateClasses as findDuplicateClassesInJsx, StyleUsage } from './jsxParser';
import { findDuplicateClassesInVue } from './vueParser';
import { findDuplicateClassesInSvelte } from './svelteParser';

export interface DetailedDuplicate {
    classString: string;
    count: number;
    locations: {
        filePath: string;
        lines: number[];
    }[];
}

export async function analyzeWorkspace(): Promise<DetailedDuplicate[]> {
    const files = await vscode.workspace.findFiles(
        '**/*.{jsx,tsx,vue,svelte}',
        '**/node_modules/**'
    );

    const usagesByClass = new Map<string, (StyleUsage & { filePath: string })[]>();

    for (const file of files) {
        const document = await vscode.workspace.openTextDocument(file);
        let usages: StyleUsage[] = [];

        switch (document.languageId) {
            case 'javascriptreact':
            case 'typescriptreact':
                usages = findDuplicateClassesInJsx(document.getText());
                break;
            case 'vue':
                usages = findDuplicateClassesInVue(document.getText());
                break;
            case 'svelte':
                usages = await findDuplicateClassesInSvelte(document);
                break;
        }

        if (usages.length > 0) {
            const relativePath = vscode.workspace.asRelativePath(file);
            const usagesWithFile = usages.map(u => ({ ...u, filePath: relativePath }));
            
            for(const usage of usagesWithFile) {
                if (!usagesByClass.has(usage.classString)) {
                    usagesByClass.set(usage.classString, []);
                }
                usagesByClass.get(usage.classString)!.push(usage);
            }
        }
    }

    const results: DetailedDuplicate[] = [];
    
    usagesByClass.forEach((locations, classString) => {
        if (locations.length > 1) {
            const locationsByFile = new Map<string, number[]>();
            
            for (const loc of locations) {
                if (!locationsByFile.has(loc.filePath)) {
                    locationsByFile.set(loc.filePath, []);
                }
                locationsByFile.get(loc.filePath)!.push(loc.location.start.line + 1);
            }

            results.push({
                classString: classString,
                count: locations.length,
                locations: Array.from(locationsByFile.entries()).map(([filePath, lines]) => ({
                    filePath,
                    lines: lines.sort((a, b) => a - b)
                }))
            });
        }
    });

    return results.sort((a, b) => b.count - a.count);
}