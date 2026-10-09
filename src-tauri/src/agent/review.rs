use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub line_type: DiffLineType,
    pub content: String,
    pub old_line_num: Option<u32>,
    pub new_line_num: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiffLineType {
    Context,
    Added,
    Removed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffFile {
    pub old_path: String,
    pub new_path: String,
    pub status: FileStatus,
    pub hunks: Vec<DiffHunk>,
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewFinding {
    pub file: String,
    pub line: u32,
    pub severity: FindingSeverity,
    pub rule: String,
    pub message: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FindingSeverity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileBundle {
    pub name: String,
    pub files: Vec<String>,
    pub total_additions: usize,
    pub total_deletions: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewDiffResponse {
    pub files_count: usize,
    pub files: Vec<DiffFile>,
    pub bundles: Vec<FileBundle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewScanResponse {
    pub findings_count: usize,
    pub findings: Vec<ReviewFinding>,
}

pub struct CodeReviewEngine;

impl CodeReviewEngine {
    /// Parse unified git diff output into structured files, hunks, and lines (open-code-review diff engine)
    pub fn parse_git_diff(raw_diff: &str) -> Vec<DiffFile> {
        let mut files = Vec::new();
        let mut current_file: Option<DiffFile> = None;
        let mut current_hunk: Option<DiffHunk> = None;

        let mut old_line = 0u32;
        let mut new_line = 0u32;

        for line in raw_diff.lines() {
            if line.starts_with("diff --git ") {
                // Flush previous hunk and file
                if let Some(mut f) = current_file.take() {
                    if let Some(h) = current_hunk.take() {
                        f.hunks.push(h);
                    }
                    files.push(f);
                }

                let parts: Vec<&str> = line.split_whitespace().collect();
                let (old_p, new_p) = if parts.len() >= 4 {
                    (
                        parts[2].trim_start_matches("a/").to_string(),
                        parts[3].trim_start_matches("b/").to_string(),
                    )
                } else {
                    ("unknown".to_string(), "unknown".to_string())
                };

                current_file = Some(DiffFile {
                    old_path: old_p.clone(),
                    new_path: new_p,
                    status: FileStatus::Modified,
                    hunks: Vec::new(),
                    additions: 0,
                    deletions: 0,
                });
            } else if line.starts_with("new file mode ") {
                if let Some(ref mut f) = current_file {
                    f.status = FileStatus::Added;
                }
            } else if line.starts_with("deleted file mode ") {
                if let Some(ref mut f) = current_file {
                    f.status = FileStatus::Deleted;
                }
            } else if line.starts_with("@@ ") {
                if let Some(h) = current_hunk.take() {
                    if let Some(ref mut f) = current_file {
                        f.hunks.push(h);
                    }
                }

                // Parse @@ -old_start,old_len +new_start,new_len @@
                let (o_start, o_len, n_start, n_len) = Self::parse_hunk_header(line);
                old_line = o_start;
                new_line = n_start;

                current_hunk = Some(DiffHunk {
                    header: line.to_string(),
                    old_start: o_start,
                    old_lines: o_len,
                    new_start: n_start,
                    new_lines: n_len,
                    lines: Vec::new(),
                });
            } else if let Some(ref mut hunk) = current_hunk {
                if line.starts_with('+') && !line.starts_with("+++") {
                    hunk.lines.push(DiffLine {
                        line_type: DiffLineType::Added,
                        content: line[1..].to_string(),
                        old_line_num: None,
                        new_line_num: Some(new_line),
                    });
                    new_line += 1;
                    if let Some(ref mut f) = current_file {
                        f.additions += 1;
                    }
                } else if line.starts_with('-') && !line.starts_with("---") {
                    hunk.lines.push(DiffLine {
                        line_type: DiffLineType::Removed,
                        content: line[1..].to_string(),
                        old_line_num: Some(old_line),
                        new_line_num: None,
                    });
                    old_line += 1;
                    if let Some(ref mut f) = current_file {
                        f.deletions += 1;
                    }
                } else if line.starts_with(' ') || line.is_empty() {
                    let content = if line.is_empty() { "" } else { &line[1..] };
                    hunk.lines.push(DiffLine {
                        line_type: DiffLineType::Context,
                        content: content.to_string(),
                        old_line_num: Some(old_line),
                        new_line_num: Some(new_line),
                    });
                    old_line += 1;
                    new_line += 1;
                }
            }
        }

        if let Some(mut f) = current_file {
            if let Some(h) = current_hunk {
                f.hunks.push(h);
            }
            files.push(f);
        }

        files
    }

    /// Smart file bundler: Groups files into isolated review units (open-code-review bundler)
    pub fn bundle_files(files: &[DiffFile]) -> Vec<FileBundle> {
        let mut bundles: std::collections::HashMap<String, Vec<&DiffFile>> =
            std::collections::HashMap::new();

        for f in files {
            let path = Path::new(&f.new_path);
            let category = if f.new_path.starts_with("src-tauri") || f.new_path.ends_with(".rs") {
                "Backend / Rust Core".to_string()
            } else if f.new_path.starts_with("src/components") {
                "Frontend / UI Components".to_string()
            } else if f.new_path.starts_with("src/surfaces") {
                "Frontend / Surfaces".to_string()
            } else if f.new_path.starts_with("src/lib") {
                "Frontend / State & IPC".to_string()
            } else if f.new_path.ends_with(".json") || f.new_path.ends_with(".toml") {
                "Config & Manifests".to_string()
            } else {
                path.parent()
                    .and_then(|p| p.to_str())
                    .unwrap_or("Root")
                    .to_string()
            };

            bundles.entry(category).or_default().push(f);
        }

        bundles
            .into_iter()
            .map(|(name, list)| {
                let total_additions = list.iter().map(|f| f.additions).sum();
                let total_deletions = list.iter().map(|f| f.deletions).sum();
                let file_paths = list.iter().map(|f| f.new_path.clone()).collect();
                FileBundle {
                    name,
                    files: file_paths,
                    total_additions,
                    total_deletions,
                }
            })
            .collect()
    }

    /// Deterministic code audit on changed diff lines (open-code-review rule matcher)
    pub fn review_diff(diff_files: &[DiffFile]) -> Vec<ReviewFinding> {
        let mut findings = Vec::new();

        for file in diff_files {
            let is_rust = file.new_path.ends_with(".rs");
            let is_ts = file.new_path.ends_with(".ts") || file.new_path.ends_with(".tsx");

            for hunk in &file.hunks {
                for line in &hunk.lines {
                    if line.line_type != DiffLineType::Added {
                        continue;
                    }
                    let line_num = line.new_line_num.unwrap_or(hunk.new_start);
                    let content = &line.content;

                    // 1. Rust Safety Rules (§Constitution)
                    if is_rust {
                        if content.contains(".unwrap()")
                            && !content.contains("#[cfg(test)]")
                            && !file.new_path.contains("test")
                        {
                            findings.push(ReviewFinding {
                                file: file.new_path.clone(),
                                line: line_num,
                                severity: FindingSeverity::Error,
                                rule: "rust/no-unwrap".to_string(),
                                message: "Constitution violation: No unwrap() in Rust outside #[cfg(test)]. Use `?` or explicit error handling.".to_string(),
                                suggestion: Some("Replace .unwrap() with ? or unwrap_or_else()".to_string()),
                            });
                        }

                        if content.contains("std::thread::sleep") && !file.new_path.contains("test")
                        {
                            findings.push(ReviewFinding {
                                file: file.new_path.clone(),
                                line: line_num,
                                severity: FindingSeverity::Warning,
                                rule: "rust/no-blocking-sleep".to_string(),
                                message: "Blocking sleep detected in async/Tauri runtime. Use tokio::time::sleep.".to_string(),
                                suggestion: Some("Replace with tokio::time::sleep(duration).await".to_string()),
                            });
                        }
                    }

                    // 2. TypeScript / React Rules (§Constitution)
                    if is_ts {
                        if content.contains(": any") || content.contains("as any") {
                            findings.push(ReviewFinding {
                                file: file.new_path.clone(),
                                line: line_num,
                                severity: FindingSeverity::Error,
                                rule: "typescript/no-explicit-any".to_string(),
                                message: "Constitution violation: No `any` in TypeScript. Use unknown or explicit interfaces.".to_string(),
                                suggestion: Some("Replace with unknown or a strongly typed interface".to_string()),
                            });
                        }

                        if content.contains("style={{") {
                            findings.push(ReviewFinding {
                                file: file.new_path.clone(),
                                line: line_num,
                                severity: FindingSeverity::Warning,
                                rule: "react/no-inline-styles".to_string(),
                                message: "Constitution rule: Prefer Tailwind tokens over inline style objects style={{...}}.".to_string(),
                                suggestion: Some("Use Tailwind CSS utility classes".to_string()),
                            });
                        }
                    }

                    // 3. Secret Leakage Detection
                    if content.contains("AIzaSy")
                        || content.contains("sk-")
                        || content.contains("ghp_")
                    {
                        findings.push(ReviewFinding {
                            file: file.new_path.clone(),
                            line: line_num,
                            severity: FindingSeverity::Error,
                            rule: "security/hardcoded-secret".to_string(),
                            message:
                                "Potential API key or secret token detected in source code commit."
                                    .to_string(),
                            suggestion: Some(
                                "Store secrets in environment variables or keyring".to_string(),
                            ),
                        });
                    }
                }
            }
        }

        findings
    }

    fn parse_hunk_header(header: &str) -> (u32, u32, u32, u32) {
        // e.g. @@ -1,7 +1,12 @@
        let clean = header
            .trim_start_matches("@@")
            .trim_end_matches("@@")
            .trim();
        let parts: Vec<&str> = clean.split_whitespace().collect();

        let parse_range = |s: &str| -> (u32, u32) {
            let raw = s.trim_start_matches('-').trim_start_matches('+');
            if let Some(comma) = raw.find(',') {
                let start = raw[..comma].parse::<u32>().unwrap_or(1);
                let len = raw[comma + 1..].parse::<u32>().unwrap_or(1);
                (start, len)
            } else {
                let start = raw.parse::<u32>().unwrap_or(1);
                (start, 1)
            }
        };

        let (o_start, o_len) = parts.first().map(|s| parse_range(s)).unwrap_or((1, 1));
        let (n_start, n_len) = parts.get(1).map(|s| parse_range(s)).unwrap_or((1, 1));

        (o_start, o_len, n_start, n_len)
    }
}
