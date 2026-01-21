# SharePoint List Items Not Loading - Debugging Guide

## Issues Found and Fixed

### 1. **Column Configuration Issue** ✅ FIXED
- **Problem**: The `fetchTasks` function was using hardcoded default column names (`Title`, `Consultant`, `StartDate`, `EndDate`) that may not exist in your SharePoint list.
- **Fix**: Removed defaults and now strictly requires explicit configuration. The component will show "Configuration Required" if columns aren't properly selected.

### 2. **Missing Re-render on Property Change** ✅ FIXED
- **Problem**: When property pane fields changed, only the property pane was refreshed, but the React component wasn't re-rendered with the new values.
- **Fix**: Added explicit `this.render()` calls in `onPropertyPaneFieldChanged` to trigger component re-renders.

### 3. **Column Auto-detection** ✅ ENHANCED
- **Problem**: Column auto-detection wasn't logging properly, making it hard to debug.
- **Fix**: Added better console logging to track which columns are being auto-detected.

## How to Debug Further

### Step 1: Open Browser Console (F12)
Check for errors in the SharePoint Workbench console:
- Look for "API request failed" messages
- Check the exact HTTP status and error text
- Verify the API URL being called

### Step 2: Verify List Selection
In the property pane:
1. ✓ Select your SharePoint list from the dropdown
2. ✓ Wait for columns to load (check console: "Loaded columns for list...")
3. ✓ Verify all required columns appear:
   - Task Title Column
   - Start Date Column
   - End Date Column

### Step 3: Check Console Logs
Look for these specific log messages:

**Expected logs when opening the webpart:**
```
WebPart render called with properties: {...}
fetchTasks called with props: {...}
Fetching tasks from URL: https://your-site/_api/web/lists(...)/items
API response received: {...}
Number of items: X
```

**Expected logs when selecting a list:**
```
Loaded columns for list: [GUID]
Auto-set column defaults: {
  titleColumn: "Title",
  ownerColumn: "...",
  startDateColumn: "...",
  endDateColumn: "..."
}
```

### Step 4: Verify Your List Schema

Run this in SharePoint Online Management Shell to verify column names:

```powershell
Connect-PnPOnline -Url "https://yoursite.sharepoint.com/sites/yoursite"
Get-PnPField -List "YourListName" | Select-Object InternalName, Title, TypeAsString, ReadOnlyField | Where-Object {$_.ReadOnlyField -eq $false}
```

Or use REST API in browser console:
```javascript
fetch('_api/web/lists/getbytitle(\'YourListName\')/fields', {
  headers: {'Accept': 'application/json'}
}).then(r => r.json()).then(d => console.table(d.value.map(f => ({
  InternalName: f.InternalName,
  Title: f.Title,
  Type: f.TypeAsString,
  ReadOnly: f.ReadOnlyField
})))))
```

## Checklist Before Testing

- [ ] Your SharePoint list has at least one item
- [ ] The list has columns for: Title, Start Date, and End Date
- [ ] Column names are spelled exactly as they appear in the list
- [ ] Date columns are formatted as DateTime (not Text)
- [ ] You have read permissions on the list
- [ ] You selected the correct list in the webpart properties
- [ ] You clicked on each column dropdown to configure them

## Common Issues

### Issue: "No Tasks Found" or Empty List
**Solution:**
1. Verify the list has items: Go to the list and check manually
2. Check column mapping: Open browser console and search for "API response received"
3. Verify dates are in correct format (ISO 8601)

### Issue: "Configuration Required" Message
**Solution:**
1. Make sure you selected a list from the "Select SharePoint List" dropdown
2. Wait for columns to load
3. Select a value for each column dropdown

### Issue: HTTP 404 or List Not Found
**Solution:**
1. Verify list name/ID is correct
2. Check you have read permissions on the list
3. List might be in a different site - verify web URL

### Issue: Column Showing Empty Values
**Solution:**
1. Column internal name might be different from title
2. Check actual column internal names using the REST API (see Step 4 above)
3. Some column types need special handling (lookup fields, multi-select, etc.)

## Testing the Fix

1. **Rebuild the project:**
   ```bash
   npm run build
   ```

2. **Start development server:**
   ```bash
   npm start
   ```

3. **In SharePoint Workbench:**
   - Click "Edit" on the webpart
   - Select your list from the dropdown
   - Verify columns auto-populate
   - Select the date columns
   - Save and check if tasks load

4. **Monitor the console** for the logs mentioned in Step 2

## Next Steps If Still Not Working

1. Share the console logs when you see "No Tasks Found"
2. Run the REST API test from Step 4 and share the column list
3. Verify the actual data in your SharePoint list (column names and data types)
4. Check if you need to expand user/lookup fields in the REST query
