import os
import ast
import re

def get_python_structure(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read())
        
        structure = []
        for node in tree.body:
            if isinstance(node, ast.FunctionDef):
                structure.append(f"  - `def {node.name}(...)`")
            elif isinstance(node, ast.AsyncFunctionDef):
                structure.append(f"  - `async def {node.name}(...)`")
            elif isinstance(node, ast.ClassDef):
                structure.append(f"  - `class {node.name}`")
                for sub_node in node.body:
                    if isinstance(sub_node, ast.FunctionDef):
                        structure.append(f"    - `def {sub_node.name}(...)`")
                    elif isinstance(sub_node, ast.AsyncFunctionDef):
                        structure.append(f"    - `async def {sub_node.name}(...)`")
        return "\n".join(structure) if structure else "  - (No classes or functions defined)"
    except Exception as e:
        return f"  - (Failed to parse: {e})"

def get_rust_structure(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        structure = []
        # Basic regex for structs, enums, impls, fns
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('pub struct') or line.startswith('struct'):
                match = re.match(r'(pub )?struct ([a-zA-Z0-9_]+)', line)
                if match: structure.append(f"  - `struct {match.group(2)}`")
            elif line.startswith('pub enum') or line.startswith('enum'):
                match = re.match(r'(pub )?enum ([a-zA-Z0-9_]+)', line)
                if match: structure.append(f"  - `enum {match.group(2)}`")
            elif line.startswith('impl '):
                match = re.match(r'impl(?:<[^>]+>)?\s+([a-zA-Z0-9_]+)', line)
                if match: structure.append(f"  - `impl {match.group(1)}`")
            elif line.startswith('pub fn ') or line.startswith('fn ') or line.startswith('pub async fn ') or line.startswith('async fn '):
                match = re.match(r'(?:pub )?(?:async )?fn ([a-zA-Z0-9_]+)', line)
                if match: structure.append(f"    - `fn {match.group(1)}(...)`")
                
        return "\n".join(structure) if structure else "  - (No structs, enums, or functions defined)"
    except Exception as e:
        return f"  - (Failed to parse: {e})"

def get_ts_structure(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        structure = []
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('export function ') or line.startswith('function '):
                match = re.match(r'(?:export )?function ([a-zA-Z0-9_]+)', line)
                if match: structure.append(f"  - `function {match.group(1)}(...)`")
            elif line.startswith('export const ') or line.startswith('const '):
                match = re.match(r'(?:export )?const ([a-zA-Z0-9_]+) = \(', line)
                if match: structure.append(f"  - `const {match.group(1)}` (Arrow Function Component)")
            elif line.startswith('export interface ') or line.startswith('interface '):
                match = re.match(r'(?:export )?interface ([a-zA-Z0-9_]+)', line)
                if match: structure.append(f"  - `interface {match.group(1)}`")
            elif line.startswith('export type ') or line.startswith('type '):
                match = re.match(r'(?:export )?type ([a-zA-Z0-9_]+)', line)
                if match: structure.append(f"  - `type {match.group(1)}`")
                
        return "\n".join(structure) if structure else "  - (No functions or interfaces found)"
    except Exception as e:
        return f"  - (Failed to parse: {e})"

def main():
    root_dir = r"C:\Users\anesx\Desktop\friday"
    
    report = ["# FRIDAY: Exhaustive File-by-File Technical Report\n"]
    report.append("This document outlines *every single file* within the core source directories and details their internal structural elements (classes, functions, structs, interfaces).\n")
    
    target_dirs = ['core', 'src', 'src-tauri/src']
    
    for d in target_dirs:
        full_path = os.path.join(root_dir, d)
        if not os.path.exists(full_path):
            continue
            
        report.append(f"## Directory: `{d}/`\n")
        
        for root, dirs, files in os.walk(full_path):
            # skip pycache
            if '__pycache__' in root: continue
            
            for file in files:
                filepath = os.path.join(root, file)
                rel_path = os.path.relpath(filepath, root_dir)
                
                report.append(f"### `{rel_path.replace(chr(92), '/')}`")
                
                if file.endswith('.py'):
                    report.append(get_python_structure(filepath))
                elif file.endswith('.rs'):
                    report.append(get_rust_structure(filepath))
                elif file.endswith('.ts') or file.endswith('.tsx'):
                    report.append(get_ts_structure(filepath))
                else:
                    report.append("  - (Configuration or asset file)")
                report.append("")
                
    with open(os.path.join(root_dir, "detailed_report.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(report))
        
    print("Report generated at detailed_report.md")

if __name__ == "__main__":
    main()
