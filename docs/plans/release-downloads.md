# Release downloads and covers

Goal: Publish downloadable Windows installers and Android companion packages with matching cover images and clear installation guidance.

1. Verify current artifact versions and source changes. Rebuild and test Android if the existing APK is stale; verify Windows packages and source provenance.
2. Design separate EXE, MSI and Android covers using FRIDAY's bundled typography, dark surfaces and real product imagery. Inspect all rendered images.
3. Prepare release notes, checksum manifest, runtime requirements and matching source documentation. Keep the README roadmap at the end.
4. Upload the packages, covers and checksums to a GitHub preview release. Verify asset names, sizes and published download links.

Risks: Windows speech and the companion gateway still need an external Python runtime. Existing Windows packages contain development-workspace changes. Android hardware validation and clean-machine installer testing require devices; a successful build does not establish those behaviors.
