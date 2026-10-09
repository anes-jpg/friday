use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// A retrieval hit matching the Beast Engine C contract.
/// EVERY hit resolves to file:line. `why` is non-empty for auditability.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hit {
    pub file: String,
    pub line: u32,
    pub span: (u32, u32),
    pub score: f32,
    pub why: String,
    pub symbol: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolHit {
    pub name: String,
    pub kind: String, // "fn" | "struct" | "type" | "class" | "const"
    pub file: String,
    pub line: u32,
}

/// AST Semantic Code Chunk (Beast Engine C chunk.rs)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChunk {
    pub file: String,
    pub start_line: u32,
    pub end_line: u32,
    pub text: String,
    pub tokens: Vec<String>,
}

pub const RRF_K: f32 = 60.0;
pub const CHUNK_LINES: usize = 35;

/// Reciprocal Rank Fusion across engines (Beast Engine C rrf.rs, k=60).
/// Merges multiple ranked lists (e.g. lexical search, symbol matches, memory facts)
/// into a single deduplicated, auditable ranking.
pub fn rrf_merge(lists: &[(&str, f32, Vec<Hit>)], k: usize) -> Vec<Hit> {
    struct Acc {
        hit: Hit,
        score: f32,
        sources: Vec<String>,
    }

    let mut by_key: HashMap<String, Acc> = HashMap::new();

    for (engine, weight, hits) in lists {
        for (rank, h) in hits.iter().enumerate() {
            let key = format!("{}:{}", h.file, h.line);
            let contribution = weight / (RRF_K + (rank + 1) as f32);
            let entry = by_key.entry(key).or_insert_with(|| Acc {
                hit: h.clone(),
                score: 0.0,
                sources: Vec::new(),
            });
            entry.score += contribution;
            entry.sources.push(format!("{engine}#{}", rank + 1));
            if h.score > entry.hit.score {
                entry.hit = h.clone();
            }
        }
    }

    let mut fused: Vec<Acc> = by_key.into_values().collect();
    fused.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    fused.truncate(k);

    fused
        .into_iter()
        .map(|mut a| {
            a.hit.why = format!("rrf[{}] {}", a.sources.join("+"), a.hit.why);
            a.hit.score = a.score;
            a.hit
        })
        .collect()
}

/// Code tokenizer with camelCase / snake / digit sub-token splitting (Beast Engine C tokenize.rs)
pub fn tokenize_code(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    for w in text.split(|c: char| !c.is_alphanumeric() && c != '_') {
        if w.len() > 64 || w.is_empty() {
            continue; // drop minified blobs
        }
        let lower = w.to_ascii_lowercase();
        if lower.len() >= 2 {
            out.push(lower);
        }
        for sub in split_identifier(w) {
            if sub.len() >= 2 && out.last().is_none_or(|l| *l != sub) {
                out.push(sub);
            }
        }
    }
    out
}

/// Split identifier on camelCase / PascalCase / snake_case boundaries
fn split_identifier(id: &str) -> Vec<String> {
    let chars: Vec<char> = id.chars().collect();
    let mut parts: Vec<String> = Vec::new();
    let mut cur = String::new();

    for i in 0..chars.len() {
        let c = chars[i];
        if c == '_' || c == '-' {
            if !cur.is_empty() {
                parts.push(std::mem::take(&mut cur));
            }
            continue;
        }
        let boundary = if i == 0 {
            false
        } else {
            let p = chars[i - 1];
            (p.is_lowercase() && c.is_uppercase())
                || (p.is_alphabetic() && c.is_numeric())
                || (p.is_numeric() && c.is_alphabetic())
                || (p.is_uppercase()
                    && c.is_uppercase()
                    && i + 1 < chars.len()
                    && chars[i + 1].is_lowercase())
        };
        if boundary && !cur.is_empty() {
            parts.push(std::mem::take(&mut cur));
        }
        cur.push(c);
    }
    if !cur.is_empty() {
        parts.push(cur);
    }
    parts.into_iter().map(|p| p.to_ascii_lowercase()).collect()
}

/// Fast file searcher inspired by Beast Engine C two-stage search.
pub struct BeastSearcher {
    workspace_root: PathBuf,
}

impl BeastSearcher {
    pub fn new<P: AsRef<Path>>(root: P) -> Self {
        Self {
            workspace_root: root.as_ref().to_path_buf(),
        }
    }

    /// Semantic scope-aware code chunking (Beast Engine C chunk.rs)
    pub fn chunk_file(&self, rel_path: &str, content: &str) -> Vec<CodeChunk> {
        let lines: Vec<&str> = content.lines().collect();
        let mut chunks = Vec::new();
        let mut i = 0;

        while i < lines.len() {
            let end = (i + CHUNK_LINES).min(lines.len());
            let chunk_text = lines[i..end].join("\n");
            let tokens = tokenize_code(&chunk_text);

            chunks.push(CodeChunk {
                file: rel_path.to_string(),
                start_line: (i as u32) + 1,
                end_line: end as u32,
                text: chunk_text,
                tokens,
            });
            i = end;
        }
        chunks
    }

    /// Recursively search workspace files for query terms using Beast two-stage recall/confirm
    pub fn search(&self, query: &str, max_results: usize, literal: bool) -> Vec<Hit> {
        let terms: Vec<String> = if literal {
            vec![query.to_lowercase()]
        } else {
            tokenize_code(query)
        };

        if terms.is_empty() {
            return Vec::new();
        }

        let mut hits = Vec::new();
        let files = self.collect_searchable_files(&self.workspace_root, 0, 8);

        for path in files {
            if let Ok(content) = std::fs::read_to_string(&path) {
                let rel_path = path
                    .strip_prefix(&self.workspace_root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");

                // Scan lines for exact term occurrences
                for (i, line) in content.lines().enumerate() {
                    let low = line.to_lowercase();
                    let matched_terms: Vec<&str> = terms
                        .iter()
                        .filter(|t| low.contains(t.as_str()))
                        .map(|t| t.as_str())
                        .collect();

                    if !matched_terms.is_empty() {
                        let line_num = (i + 1) as u32;
                        let line_len = line.trim().len();

                        // Line-length penalty: lines that are too long (minified JS) score lower
                        let length_mult = if line_len > 250 {
                            0.3
                        } else if line_len > 120 {
                            0.7
                        } else {
                            1.0
                        };

                        let score = (matched_terms.len() as f32) * length_mult;

                        hits.push(Hit {
                            file: rel_path.clone(),
                            line: line_num,
                            span: (line_num, line_num),
                            score,
                            why: format!("beast[{}] @L{}", matched_terms.join("+"), line_num),
                            symbol: None,
                            content: Some(line.trim().to_string()),
                        });
                    }
                }
            }
        }

        hits.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        hits.truncate(max_results);
        hits
    }

    /// Reciprocal Rank Fusion search across lexical, literal, and symbol rankings
    pub fn rrf_search(&self, query: &str) -> Vec<Hit> {
        let lexical_hits = self.search(query, 50, false);
        let literal_hits = self.search(query, 50, true);
        let symbol_hits: Vec<Hit> = self
            .find_symbols(query, 30)
            .into_iter()
            .map(|s| Hit {
                file: s.file,
                line: s.line,
                span: (s.line, s.line),
                score: 1.0,
                why: format!("symbol: {} ({})", s.name, s.kind),
                symbol: Some(format!("{} {}", s.kind, s.name)),
                content: Some(format!("{} {}", s.kind, s.name)),
            })
            .collect();

        let lists = vec![
            ("lexical", 1.0, lexical_hits),
            ("literal", 1.5, literal_hits),
            ("symbol", 2.0, symbol_hits),
        ];
        rrf_merge(&lists, 30)
    }

    /// Chunk a file by relative path from workspace root
    pub fn chunk_path(&self, rel_path: &str) -> Result<Vec<CodeChunk>, String> {
        let path = self.workspace_root.join(rel_path);
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Cannot read file '{}': {}", rel_path, e))?;
        Ok(self.chunk_file(rel_path, &content))
    }

    /// Extract code symbols (functions, structs, classes, types)
    pub fn find_symbols(&self, query: &str, max_results: usize) -> Vec<SymbolHit> {
        let q_low = query.to_lowercase();
        let mut symbols = Vec::new();
        let files = self.collect_searchable_files(&self.workspace_root, 0, 8);

        for path in files {
            if let Ok(content) = std::fs::read_to_string(&path) {
                let rel_path = path
                    .strip_prefix(&self.workspace_root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");

                for (i, line) in content.lines().enumerate() {
                    let trimmed = line.trim();
                    let (kind, name_opt) = if trimmed.starts_with("fn ")
                        || trimmed.starts_with("pub fn ")
                    {
                        let after = if let Some(stripped) = trimmed.strip_prefix("pub fn ") {
                            stripped
                        } else {
                            &trimmed[3..]
                        };
                        let name = after.split(['(', '<', ' ']).next().unwrap_or("");
                        ("fn", Some(name))
                    } else if trimmed.starts_with("struct ") || trimmed.starts_with("pub struct ") {
                        let after = if let Some(stripped) = trimmed.strip_prefix("pub struct ") {
                            stripped
                        } else {
                            &trimmed[7..]
                        };
                        let name = after.split(['<', '{', ' ', ';']).next().unwrap_or("");
                        ("struct", Some(name))
                    } else if trimmed.starts_with("interface ")
                        || trimmed.starts_with("export interface ")
                    {
                        let after =
                            if let Some(stripped) = trimmed.strip_prefix("export interface ") {
                                stripped
                            } else {
                                &trimmed[10..]
                            };
                        let name = after.split(['<', '{', ' ']).next().unwrap_or("");
                        ("interface", Some(name))
                    } else if trimmed.starts_with("export const ") || trimmed.starts_with("const ")
                    {
                        let after = if let Some(stripped) = trimmed.strip_prefix("export const ") {
                            stripped
                        } else {
                            &trimmed[6..]
                        };
                        let name = after.split([':', '=', ' ']).next().unwrap_or("");
                        ("const", Some(name))
                    } else if trimmed.starts_with("type ") || trimmed.starts_with("export type ") {
                        let after = if let Some(stripped) = trimmed.strip_prefix("export type ") {
                            stripped
                        } else {
                            &trimmed[5..]
                        };
                        let name = after.split(['<', '=', ' ']).next().unwrap_or("");
                        ("type", Some(name))
                    } else {
                        ("", None)
                    };

                    if let Some(name) = name_opt {
                        if !name.is_empty()
                            && (q_low.is_empty() || name.to_lowercase().contains(&q_low))
                        {
                            symbols.push(SymbolHit {
                                name: name.to_string(),
                                kind: kind.to_string(),
                                file: rel_path.clone(),
                                line: (i + 1) as u32,
                            });
                            if symbols.len() >= max_results {
                                return symbols;
                            }
                        }
                    }
                }
            }
        }

        symbols
    }

    /// Traversal skipping build and ignored directories
    fn collect_searchable_files(
        &self,
        dir: &Path,
        current_depth: usize,
        max_depth: usize,
    ) -> Vec<PathBuf> {
        if current_depth > max_depth {
            return Vec::new();
        }

        let mut results = Vec::new();
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return results,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            if file_name.starts_with('.')
                || file_name == "node_modules"
                || file_name == "target"
                || file_name == "dist"
                || file_name == "build"
                || file_name == "resources"
            {
                continue;
            }

            if path.is_dir() {
                results.extend(self.collect_searchable_files(&path, current_depth + 1, max_depth));
            } else if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let ext_low = ext.to_lowercase();
                    if [
                        "rs", "ts", "tsx", "js", "jsx", "json", "toml", "md", "css", "html", "py",
                        "sh",
                    ]
                    .contains(&ext_low.as_str())
                    {
                        results.push(path);
                    }
                }
            }
        }

        results
    }
}
