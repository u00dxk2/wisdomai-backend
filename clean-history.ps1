# Script to remove sensitive files from git history (frontend)
Write-Host "Starting frontend history cleanup process..."

# Set environment variable to squelch warning
$env:FILTER_BRANCH_SQUELCH_WARNING = 1

# Remove .env files from all commits
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env .env.production .env.backup" --prune-empty --tag-name-filter cat -- --all

Write-Host "History cleanup completed!"
Write-Host "Next steps:"
Write-Host "1. Run 'git push origin --force' to update the remote repository"
Write-Host "2. Tell all collaborators to re-clone the repository"
Write-Host "3. Update your .env file with your new secure credentials" 