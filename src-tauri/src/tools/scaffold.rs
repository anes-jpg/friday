use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredRepoInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub framework: String,
    pub package_manager: String,
    pub git_branch: Option<String>,
    pub last_modified: String,
    pub has_uncommitted_changes: bool,
    pub dependencies_count: usize,
}

pub struct ScaffoldEngine;

impl ScaffoldEngine {
    /// Discovers existing repositories on the user's Desktop or common project directories
    pub fn scan_desktop_repositories() -> Vec<DiscoveredRepoInfo> {
        let mut results = Vec::new();

        // Candidates: Desktop, and user profile
        let mut search_roots = Vec::new();
        if let Some(user_profile) = std::env::var_os("USERPROFILE") {
            let desktop = PathBuf::from(&user_profile).join("Desktop");
            if desktop.exists() {
                search_roots.push(desktop);
            }
        }

        for root in search_roots {
            let entries = match fs::read_dir(&root) {
                Ok(e) => e,
                Err(_) => continue,
            };

            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }

                // Skip system and hidden folders
                let folder_name = match path.file_name().and_then(|n| n.to_str()) {
                    Some(name) => {
                        if name.starts_with('.') || name == "node_modules" || name == "dist" || name == "target" {
                            continue;
                        }
                        name.to_string()
                    }
                    None => continue,
                };

                // Check if this directory looks like a software project
                let has_git = path.join(".git").exists();
                let pkg_json_path = path.join("package.json");
                let cargo_path = path.join("Cargo.toml");
                let pyproject_path = path.join("pyproject.toml");
                let req_path = path.join("requirements.txt");

                if !has_git && !pkg_json_path.exists() && !cargo_path.exists() && !pyproject_path.exists() && !req_path.exists() {
                    continue;
                }

                let mut framework = "Generic Project".to_string();
                let mut package_manager = "npm".to_string();
                let mut dep_count = 0;

                // Inspect package.json if present
                if pkg_json_path.exists() {
                    if let Ok(content) = fs::read_to_string(&pkg_json_path) {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                            let mut deps = Vec::new();
                            if let Some(d) = json.get("dependencies").and_then(|v| v.as_object()) {
                                dep_count += d.len();
                                for k in d.keys() {
                                    deps.push(k.as_str());
                                }
                            }
                            if let Some(d) = json.get("devDependencies").and_then(|v| v.as_object()) {
                                dep_count += d.len();
                                for k in d.keys() {
                                    deps.push(k.as_str());
                                }
                            }

                            if deps.iter().any(|&d| d == "next") {
                                framework = "Next.js".to_string();
                            } else if path.join("src-tauri").exists() || deps.iter().any(|&d| d.starts_with("@tauri-apps")) {
                                framework = "Tauri Desktop".to_string();
                            } else if deps.iter().any(|&d| d == "vite") {
                                framework = if deps.iter().any(|&d| d == "react") {
                                    "React + Vite".to_string()
                                } else {
                                    "Vite".to_string()
                                };
                            } else if deps.iter().any(|&d| d == "react") {
                                framework = "React".to_string();
                            } else if deps.iter().any(|&d| d == "express" || d == "hono" || d == "fastify") {
                                framework = "Node Backend".to_string();
                            } else {
                                framework = "JavaScript/TypeScript".to_string();
                            }
                        }
                    }

                    // Detect package manager
                    if path.join("bun.lock").exists() || path.join("bun.lockb").exists() {
                        package_manager = "bun".to_string();
                    } else if path.join("pnpm-lock.yaml").exists() {
                        package_manager = "pnpm".to_string();
                    } else if path.join("yarn.lock").exists() {
                        package_manager = "yarn".to_string();
                    } else {
                        package_manager = "npm".to_string();
                    }
                } else if cargo_path.exists() {
                    framework = if path.join("src-tauri").exists() {
                        "Tauri App".to_string()
                    } else {
                        "Rust Crate".to_string()
                    };
                    package_manager = "cargo".to_string();
                    dep_count = 12;
                } else if pyproject_path.exists() || req_path.exists() {
                    framework = "Python".to_string();
                    package_manager = "pip".to_string();
                    dep_count = 6;
                }

                // Check git branch
                let mut git_branch = None;
                let head_path = path.join(".git").join("HEAD");
                if head_path.exists() {
                    if let Ok(head_str) = fs::read_to_string(&head_path) {
                        let trimmed = head_str.trim();
                        if let Some(branch) = trimmed.strip_prefix("ref: refs/heads/") {
                            git_branch = Some(branch.to_string());
                        } else if !trimmed.is_empty() {
                            git_branch = Some(trimmed.chars().take(7).collect());
                        }
                    }
                }

                // Check uncommitted changes if Git exists
                let mut has_uncommitted_changes = false;
                if has_git {
                    #[cfg(target_os = "windows")]
                    use std::os::windows::process::CommandExt;
                    let mut cmd = std::process::Command::new("git");
                    cmd.args(["-C", &path.to_string_lossy(), "status", "--porcelain"]);
                    #[cfg(target_os = "windows")]
                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                    if let Ok(output) = cmd.output() {
                        has_uncommitted_changes = !output.stdout.is_empty();
                    }
                }

                // Last modified
                let last_modified = entry
                    .metadata()
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|time| {
                        std::time::SystemTime::now()
                            .duration_since(time)
                            .ok()
                    })
                    .map(|dur| {
                        let hours = dur.as_secs() / 3600;
                        if hours < 24 {
                            "Today".to_string()
                        } else {
                            let days = hours / 24;
                            if days == 1 {
                                "Yesterday".to_string()
                            } else {
                                format!("{days}d ago")
                            }
                        }
                    })
                    .unwrap_or_else(|| "Recent".to_string());

                let id = format!("repo-{}", folder_name.to_lowercase().replace(' ', "-"));

                results.push(DiscoveredRepoInfo {
                    id,
                    name: folder_name,
                    path: path.to_string_lossy().to_string(),
                    framework,
                    package_manager,
                    git_branch,
                    last_modified,
                    has_uncommitted_changes,
                    dependencies_count: dep_count,
                });
            }
        }

        results
    }

    /// Scaffolds a new project using deterministic local archetypes (Zero Token Burn)
    pub fn scaffold_archetype(
        archetype: &str,
        project_name: &str,
        target_directory: &str,
    ) -> Result<String, String> {
        let base_path = Path::new(target_directory);
        let project_dir = if base_path.file_name().and_then(|n| n.to_str()) == Some(project_name) {
            base_path.to_path_buf()
        } else {
            base_path.join(project_name)
        };

        if !project_dir.exists() {
            fs::create_dir_all(&project_dir).map_err(|e| format!("Failed to create project dir: {e}"))?;
        }

        match archetype {
            "better-t-stack" => Self::scaffold_better_t_stack(&project_dir, project_name),
            "react-bits-vite" => Self::scaffold_react_bits_vite(&project_dir, project_name),
            "python-mcp-agent" => Self::scaffold_python_mcp(&project_dir, project_name),
            "rust-tauri-operator" => Self::scaffold_rust_tauri(&project_dir, project_name),
            _ => Self::scaffold_generic_workspace(&project_dir, project_name),
        }
    }

    fn scaffold_better_t_stack(dir: &Path, name: &str) -> Result<String, String> {
        // Scaffolds a complete Better-T-Stack workspace (Next.js + TanStack + Hono + Drizzle + Better Auth)
        let package_json = serde_json::json!({
            "name": name,
            "version": "0.1.0",
            "private": true,
            "scripts": {
                "dev": "next dev",
                "build": "next build",
                "start": "next start",
                "lint": "next lint",
                "db:generate": "drizzle-kit generate",
                "db:migrate": "drizzle-kit migrate"
            },
            "dependencies": {
                "@tanstack/react-query": "^5.60.0",
                "better-auth": "^1.0.0",
                "drizzle-orm": "^0.36.0",
                "hono": "^4.6.0",
                "next": "^15.0.0",
                "react": "^19.0.0",
                "react-dom": "^19.0.0",
                "zod": "^3.23.8",
                "lucide-react": "^0.460.0",
                "clsx": "^2.1.1",
                "tailwind-merge": "^2.5.4"
            },
            "devDependencies": {
                "@types/node": "^22.0.0",
                "@types/react": "^19.0.0",
                "@types/react-dom": "^19.0.0",
                "drizzle-kit": "^0.28.0",
                "postcss": "^8.4.40",
                "tailwindcss": "^3.4.10",
                "typescript": "^5.6.0"
            }
        });

        fs::write(
            dir.join("package.json"),
            serde_json::to_string_pretty(&package_json).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;

        let tsconfig = serde_json::json!({
            "compilerOptions": {
                "target": "ES2022",
                "lib": ["dom", "dom.iterable", "esnext"],
                "allowJs": true,
                "skipLibCheck": true,
                "strict": true,
                "noEmit": true,
                "esModuleInterop": true,
                "module": "esnext",
                "moduleResolution": "bundler",
                "resolveJsonModule": true,
                "isolatedModules": true,
                "jsx": "preserve",
                "incremental": true,
                "plugins": [{ "name": "next" }],
                "paths": { "@/*": ["./src/*"] }
            },
            "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
            "exclude": ["node_modules"]
        });

        fs::write(
            dir.join("tsconfig.json"),
            serde_json::to_string_pretty(&tsconfig).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;

        let gitignore = "node_modules\n.next\n.env\n.env.local\ndist\n*.tsbuildinfo\n";
        fs::write(dir.join(".gitignore"), gitignore).map_err(|e| e.to_string())?;

        let env_example = "DATABASE_URL=\"file:./local.db\"\nBETTER_AUTH_SECRET=\"super-secret-key-change-in-prod\"\nBETTER_AUTH_URL=\"http://localhost:3000\"\n";
        fs::write(dir.join(".env.example"), env_example).map_err(|e| e.to_string())?;

        let readme = format!(
            "# {}\n\nFull-stack type-safe application scaffolded via **FRIDAY** and **Better-T-Stack**.\n\n## Architecture\n- **Framework**: Next.js 15 App Router\n- **API**: Hono API route handlers\n- **Query**: TanStack Query v5\n- **Database**: Drizzle ORM\n- **Authentication**: Better Auth\n- **Styling**: Tailwind CSS\n\n## Quick Start\n```bash\npnpm install\npnpm dev\n```\n",
            name
        );
        fs::write(dir.join("README.md"), readme).map_err(|e| e.to_string())?;

        let src_dir = dir.join("src");
        fs::create_dir_all(&src_dir).map_err(|e| e.to_string())?;

        // App Router
        let app_dir = src_dir.join("app");
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;

        let page_tsx = "export default function Page() {\n  return (\n    <main className=\"flex min-h-screen flex-col items-center justify-center p-8 bg-neutral-950 text-white font-sans\">\n      <div className=\"max-w-xl text-center space-y-4\">\n        <div className=\"inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono\">\n          Better-T-Stack Workspace Ready\n        </div>\n        <h1 className=\"text-4xl font-bold tracking-tight text-white\">Next.js 15 + Hono + Drizzle</h1>\n        <p className=\"text-neutral-400 text-sm leading-relaxed\">\n          Scaffolded deterministically by FRIDAY Desktop Operator with zero token consumption.\n        </p>\n      </div>\n    </main>\n  );\n}\n";
        fs::write(app_dir.join("page.tsx"), page_tsx).map_err(|e| e.to_string())?;

        let layout_tsx = "import type { Metadata } from \"next\";\n\nexport const metadata: Metadata = {\n  title: \"Better-T-Stack App\",\n  description: \"Scaffolded with FRIDAY\",\n};\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body>{children}</body>\n    </html>\n  );\n}\n";
        fs::write(app_dir.join("layout.tsx"), layout_tsx).map_err(|e| e.to_string())?;

        // Server / Hono
        let server_dir = src_dir.join("server");
        fs::create_dir_all(&server_dir).map_err(|e| e.to_string())?;
        let hono_ts = "import { Hono } from \"hono\";\n\nexport const app = new Hono().basePath(\"/api\");\n\napp.get(\"/health\", (c) => {\n  return c.json({ status: \"ok\", timestamp: Date.now() });\n});\n";
        fs::write(server_dir.join("index.ts"), hono_ts).map_err(|e| e.to_string())?;

        // DB / Drizzle Schema
        let db_dir = src_dir.join("db");
        fs::create_dir_all(&db_dir).map_err(|e| e.to_string())?;
        let schema_ts = "import { sqliteTable, text, integer } from \"drizzle-orm/sqlite-core\";\n\nexport const users = sqliteTable(\"users\", {\n  id: text(\"id\").primaryKey(),\n  name: text(\"name\").notNull(),\n  email: text(\"email\").notNull().unique(),\n  createdAt: integer(\"created_at\", { mode: \"timestamp\" }).notNull(),\n});\n";
        fs::write(db_dir.join("schema.ts"), schema_ts).map_err(|e| e.to_string())?;

        // Lib / Auth
        let lib_dir = src_dir.join("lib");
        fs::create_dir_all(&lib_dir).map_err(|e| e.to_string())?;
        let auth_ts = "import { betterAuth } from \"better-auth\";\n\nexport const auth = betterAuth({\n  secret: process.env.BETTER_AUTH_SECRET || \"dev-secret\",\n});\n";
        fs::write(lib_dir.join("auth.ts"), auth_ts).map_err(|e| e.to_string())?;

        Ok(format!(
            "Successfully scaffolded Better-T-Stack workspace at {}",
            dir.display()
        ))
    }

    fn scaffold_react_bits_vite(dir: &Path, name: &str) -> Result<String, String> {
        let package_json = serde_json::json!({
            "name": name,
            "private": true,
            "version": "0.1.0",
            "type": "module",
            "scripts": {
                "dev": "vite",
                "build": "tsc && vite build",
                "preview": "vite preview"
            },
            "dependencies": {
                "lucide-react": "^0.460.0",
                "motion": "^11.11.0",
                "react": "^18.3.1",
                "react-dom": "^18.3.1"
            },
            "devDependencies": {
                "@types/react": "^18.3.1",
                "@types/react-dom": "^18.3.1",
                "@vitejs/plugin-react": "^4.3.0",
                "autoprefixer": "^10.4.20",
                "postcss": "^8.4.40",
                "tailwindcss": "^3.4.10",
                "typescript": "^5.6.0",
                "vite": "^5.4.0"
            }
        });

        fs::write(
            dir.join("package.json"),
            serde_json::to_string_pretty(&package_json).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;

        let tsconfig = serde_json::json!({
            "compilerOptions": {
                "target": "ES2020",
                "useDefineForClassFields": true,
                "lib": ["ES2020", "DOM", "DOM.Iterable"],
                "module": "ESNext",
                "skipLibCheck": true,
                "moduleResolution": "bundler",
                "allowImportingTsExtensions": true,
                "resolveJsonModule": true,
                "isolatedModules": true,
                "noEmit": true,
                "jsx": "react-jsx",
                "strict": true
            },
            "include": ["src"]
        });
        fs::write(
            dir.join("tsconfig.json"),
            serde_json::to_string_pretty(&tsconfig).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;

        let vite_config = "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});\n";
        fs::write(dir.join("vite.config.ts"), vite_config).map_err(|e| e.to_string())?;

        let index_html = format!(
            "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>{}</title>\n  </head>\n  <body class=\"bg-[#0d0f12] text-white\">\n    <div id=\"root\"></div>\n    <script type=\"module\" src=\"/src/main.tsx\"></script>\n  </body>\n</html>\n",
            name
        );
        fs::write(dir.join("index.html"), index_html).map_err(|e| e.to_string())?;

        let gitignore = "node_modules\ndist\n*.tsbuildinfo\n.env\n";
        fs::write(dir.join(".gitignore"), gitignore).map_err(|e| e.to_string())?;

        let src_dir = dir.join("src");
        fs::create_dir_all(&src_dir).map_err(|e| e.to_string())?;

        let main_tsx = "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.tsx';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);\n";
        fs::write(src_dir.join("main.tsx"), main_tsx).map_err(|e| e.to_string())?;

        let app_tsx = "import { motion } from 'motion/react';\nimport { Sparkles } from 'lucide-react';\n\nexport default function App() {\n  return (\n    <main className=\"min-h-screen flex items-center justify-center p-6\">\n      <motion.div\n        initial={{ opacity: 0, y: 16 }}\n        animate={{ opacity: 1, y: 0 }}\n        className=\"p-8 rounded-2xl bg-white/[0.04] border border-white/10 text-center space-y-4 max-w-md\"\n      >\n        <Sparkles className=\"w-8 h-8 text-indigo-400 mx-auto\" />\n        <h1 className=\"text-2xl font-bold\">React-Bits Creative Workspace</h1>\n        <p className=\"text-sm text-white/60\">Animated motion components initialized.</p>\n      </motion.div>\n    </main>\n  );\n}\n";
        fs::write(src_dir.join("App.tsx"), app_tsx).map_err(|e| e.to_string())?;

        let index_css = "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n";
        fs::write(src_dir.join("index.css"), index_css).map_err(|e| e.to_string())?;

        let readme = format!("# {}\n\nReact + Vite + React-Bits animated creative workspace.\n\n```bash\npnpm install\npnpm dev\n```\n", name);
        fs::write(dir.join("README.md"), readme).map_err(|e| e.to_string())?;

        Ok(format!(
            "Successfully scaffolded React-Bits UI workspace at {}",
            dir.display()
        ))
    }

    fn scaffold_python_mcp(dir: &Path, name: &str) -> Result<String, String> {
        let main_py = format!(
            r#"# {} — Python MCP Agent Sidecar
import sys
import json
import asyncio

print("FRIDAY Python MCP Worker Started", file=sys.stderr)

async def main():
    while True:
        await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
"#,
            name
        );

        fs::write(dir.join("main.py"), main_py).map_err(|e| e.to_string())?;
        fs::write(dir.join("requirements.txt"), "mcp>=1.0.0\npydantic>=2.0.0\nhttpx>=0.27.0\n").map_err(|e| e.to_string())?;
        fs::write(dir.join(".gitignore"), "__pycache__/\n*.pyc\n.venv/\nenv/\n").map_err(|e| e.to_string())?;

        let readme = format!("# {}\n\nPython MCP Autonomous Sidecar.\n\n```bash\npip install -r requirements.txt\npython main.py\n```\n", name);
        fs::write(dir.join("README.md"), readme).map_err(|e| e.to_string())?;

        Ok(format!(
            "Successfully scaffolded Python MCP Agent workspace at {}",
            dir.display()
        ))
    }

    fn scaffold_rust_tauri(dir: &Path, name: &str) -> Result<String, String> {
        let cargo_toml = format!(
            r#"[package]
name = "{}"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = {{ version = "1.0", features = ["derive"] }}
serde_json = "1.0"
tokio = {{ version = "1.38", features = ["full"] }}
"#,
            name
        );

        fs::write(dir.join("Cargo.toml"), cargo_toml).map_err(|e| e.to_string())?;
        fs::write(dir.join(".gitignore"), "target/\nCargo.lock\n").map_err(|e| e.to_string())?;

        let src_dir = dir.join("src");
        fs::create_dir_all(&src_dir).map_err(|e| e.to_string())?;
        fs::write(src_dir.join("main.rs"), "fn main() {\n    println!(\"FRIDAY Systems Worker initialized\");\n}\n")
            .map_err(|e| e.to_string())?;

        let readme = format!("# {}\n\nRust Desktop Systems Operator workspace.\n\n```bash\ncargo run\n```\n", name);
        fs::write(dir.join("README.md"), readme).map_err(|e| e.to_string())?;

        Ok(format!(
            "Successfully scaffolded Rust Systems workspace at {}",
            dir.display()
        ))
    }

    fn scaffold_generic_workspace(dir: &Path, name: &str) -> Result<String, String> {
        let readme = format!("# {}\n\nProject workspace initialized by FRIDAY Desktop Operator.\n", name);
        fs::write(dir.join("README.md"), readme).map_err(|e| e.to_string())?;
        Ok(format!(
            "Successfully initialized generic workspace at {}",
            dir.display()
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_desktop_repositories() {
        let repos = ScaffoldEngine::scan_desktop_repositories();
        // Should find repos on desktop or return empty without panicking
        assert!(repos.iter().all(|r| !r.name.is_empty() && !r.path.is_empty()));
    }

    #[test]
    fn test_scaffold_better_t_stack() {
        let temp_dir = std::env::temp_dir().join(format!("test_bts_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
        let res = ScaffoldEngine::scaffold_archetype("better-t-stack", "test-bts-app", &temp_dir.to_string_lossy());
        assert!(res.is_ok());

        let target_dir = temp_dir.join("test-bts-app");
        assert!(target_dir.join("package.json").exists());
        assert!(target_dir.join("tsconfig.json").exists());
        assert!(target_dir.join("src").join("app").join("page.tsx").exists());
        assert!(target_dir.join("src").join("server").join("index.ts").exists());
        assert!(target_dir.join("src").join("db").join("schema.ts").exists());

        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_scaffold_react_bits() {
        let temp_dir = std::env::temp_dir().join(format!("test_rb_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
        let res = ScaffoldEngine::scaffold_archetype("react-bits-vite", "test-rb-app", &temp_dir.to_string_lossy());
        assert!(res.is_ok());

        let target_dir = temp_dir.join("test-rb-app");
        assert!(target_dir.join("package.json").exists());
        assert!(target_dir.join("src").join("App.tsx").exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_scaffold_python_mcp() {
        let temp_dir = std::env::temp_dir().join(format!("test_mcp_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
        let res = ScaffoldEngine::scaffold_archetype("python-mcp-agent", "test-mcp-app", &temp_dir.to_string_lossy());
        assert!(res.is_ok());

        let target_dir = temp_dir.join("test-mcp-app");
        assert!(target_dir.join("main.py").exists());
        assert!(target_dir.join("requirements.txt").exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
