import * as vscode from 'vscode';
import { findDuplicateClasses as findDuplicateClassesInJsx, StyleUsage } from './jsxParser';
import { findDuplicateClassesInVue } from './vueParser';
import { findDuplicateClassesInSvelte } from './svelteParser';


export interface GroupedDuplicate {
    classString: string;
    count: number;
    files: string[]; 
}


export async function analyzeWorkspace(): Promise<GroupedDuplicate[]> {

    const files = await vscode.workspace.findFiles(
        '**/*.{jsx,tsx,vue,svelte}', 
        '**/node_modules/**'        
    );

    const allUsages: (StyleUsage & { filePath: string })[] = [];


    for (const file of files) {
        const document = await vscode.workspace.openTextDocument(file);
        const languageId = document.languageId;
        let usages: StyleUsage[] = [];

        switch (languageId) {
            case 'javascriptreact':
            case 'typescriptreact':
                usages = findDuplicateClassesInJsx(document.getText());
                break;
            case 'vue':
                usages = findDuplicateClassesInVue(document.getText());
                break;
            case 'svelte':
                usages = findDuplicateClassesInSvelte(document);
                break;
        }

   
        const usagesWithFile = usages.map(u => ({ ...u, filePath: vscode.workspace.asRelativePath(file) }));
        allUsages.push(...usagesWithFile);
    }


    const grouped = new Map<string, { count: number; files: Set<string> }>();
    for (const usage of allUsages) {
        if (!grouped.has(usage.classString)) {
            grouped.set(usage.classString, { count: 0, files: new Set() });
        }
        const entry = grouped.get(usage.classString)!;
        entry.count++;
        entry.files.add(usage.filePath);
    }

   
    const results: GroupedDuplicate[] = [];
    grouped.forEach((value, key) => {
        results.push({
            classString: key,
            count: value.count,
            files: Array.from(value.files)
        });
    });


    return results.sort((a, b) => b.count - a.count);
}