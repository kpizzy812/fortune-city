#!/bin/bash
# Fix for Anchor 0.31.1 + Solana platform-tools v1.51 edition2024 issue
# See: https://github.com/anza-xyz/agave/issues/8443
# See: https://github.com/anza-xyz/solana-sdk/issues/385

set -e

echo "🔧 Fixing edition2024 compatibility issue..."
echo ""
echo "Problem: blake3 1.8.3 and constant_time_eq 0.4.2 require edition2024"
echo "Solution: Downgrade blake3 to 1.8.2 (which uses constant_time_eq 0.3.1)"
echo ""

# Clean existing lock file
if [ -f "Cargo.lock" ]; then
    echo "🗑️  Removing existing Cargo.lock..."
    rm Cargo.lock
fi

# Generate fresh lock file
echo "📦 Generating fresh Cargo.lock..."
cargo generate-lockfile

# Downgrade blake3 (this will automatically downgrade constant_time_eq)
echo "⬇️  Downgrading blake3 to 1.8.2..."
cargo update -p blake3 --precise 1.8.2

echo ""
echo "✅ Done! You can now run 'anchor build'"
echo ""
echo "Dependencies fixed:"
cargo tree -p blake3 -p constant_time_eq | grep -E "^(blake3|constant_time_eq)"
