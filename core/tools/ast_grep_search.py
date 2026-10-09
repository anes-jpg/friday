import subprocess
import json

class ASTGrepTool:
    """
    Exposes ast-grep for semantic, AST-aware codebase search.
    Replaces basic regex search with structural queries to find code precisely.
    """
    def __init__(self, workspace_path: str = "."):
        self.workspace_path = workspace_path
        
    def find_pattern(self, pattern: str, language: str) -> list:
        """
        Runs `ast-grep` against the workspace.
        Example: find_pattern("def $FUNC($ARGS): $BODY", "python")
        """
        try:
            # We assume ast-grep (`sg`) is installed in the system PATH
            cmd = ["sg", "--pattern", pattern, "--json", "--lang", language]
            result = subprocess.run(cmd, cwd=self.workspace_path, capture_output=True, text=True)
            
            if result.returncode != 0:
                return [f"Error running ast-grep: {result.stderr}"]
                
            matches = json.loads(result.stdout)
            return [
                f"File: {m['file']} Line: {m['range']['start']['line']} - Match: {m['text']}" 
                for m in matches
            ]
        except Exception as e:
            return [f"AST Grep Execution Error: {str(e)}"]

if __name__ == "__main__":
    tool = ASTGrepTool()
    print(tool.find_pattern("class $NAME:", "python"))
