# How to Compile and Test Your SharePoint Gantt Timeline View Project

This guide will walk you through the steps to compile, build, and test your SharePoint Framework (SPFx) Gantt Timeline View web part.

## Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (version 22.14.0 or higher, but less than 23.0.0)
   - Check your version: `node --version`
   - If needed, install from [nodejs.org](https://nodejs.org/)

2. **npm** (comes with Node.js)
   - Check your version: `npm --version`

3. **SharePoint Development Environment**
   - Access to a SharePoint Online tenant or SharePoint 2019/2022 on-premises
   - Or use a Microsoft 365 Developer tenant ([sign up here](https://developer.microsoft.com/microsoft-365/dev-program))

4. **Global Heft Tool** (optional, but recommended for SPFx projects)
   ```bash
   npm install -g @rushstack/heft
   ```

## Step 1: Install Dependencies

First, navigate to your project directory and install all required dependencies:

```bash
cd /Users/harryli/sandbox/Gantt
npm install
```

This will install all the packages listed in `package.json`, including:
- SharePoint Framework libraries
- React and React DOM
- Frappe Gantt library
- TypeScript and build tools

**Note:** This may take several minutes on first run.

## Step 2: Build for Development/Testing

To compile and start the development server for local testing:

```bash
npm start
```

This command:
- Compiles TypeScript to JavaScript
- Bundles the web part using webpack
- Starts a local development server on port **4321**
- Opens your browser to the SharePoint Workbench (if configured)

You should see output indicating the build is successful and the server is running.

## Step 3: Test in SharePoint Workbench

### Option A: Local Workbench (for initial testing)

The `npm start` command should automatically open:
```
https://localhost:4321/temp/workbench.html
```

**Note:** You may need to accept the self-signed SSL certificate in your browser.

1. Click the **+** button to add a web part
2. Find **"TimeLineView"** in the toolbox
3. Add it to the page
4. Configure the web part properties:
   - **Description**: (optional)
   - **Task List Name**: Enter the name of your SharePoint task list (default: "Tasks")

### Option B: SharePoint Workbench (recommended for full testing)

For testing with actual SharePoint data and APIs:

1. Go to your SharePoint site (e.g., `https://yourtenant.sharepoint.com`)
2. Append `/_layouts/workbench.aspx` to the URL:
   ```
   https://yourtenant.sharepoint.com/_layouts/workbench.aspx
   ```
3. Add the **TimeLineView** web part to the page
4. Configure the **Task List Name** in the web part properties
5. The web part will connect to your actual SharePoint task list

**Important:** Make sure your task list has the required columns:
- **ID** (automatically created)
- **Task** (or Title - the task name)
- **Owner** (Person column)
- **Start date** (Date column)
- **End date** (Date column)

## Step 4: Build for Production

When you're ready to deploy to SharePoint:

```bash
npm run build
```

This command:
- Runs tests (if configured)
- Creates a production build (optimized and minified)
- Packages the solution into a `.sppkg` file in the `sharepoint/solution/` folder

The `.sppkg` file can then be:
1. Uploaded to your SharePoint App Catalog
2. Deployed to site collections
3. Added to pages as a web part

## Step 5: Package for Deployment

After building, the solution package is automatically created. You can find it at:
```
sharepoint/solution/gantt.sppkg
```

To deploy:
1. Go to your SharePoint Admin Center
2. Navigate to **More features** → **Apps** → **App Catalog**
3. Upload the `.sppkg` file
4. Deploy the solution to site collections where needed

## Troubleshooting

### Build Errors

If you encounter build errors:

1. **Clean the build cache:**
   ```bash
   npm run clean
   npm install
   npm start
   ```

2. **Check Node.js version:**
   ```bash
   node --version
   ```
   Must be >= 22.14.0 and < 23.0.0

3. **Clear npm cache:**
   ```bash
   npm cache clean --force
   npm install
   ```

### Port Already in Use

If port 4321 is already in use:

1. Stop the other process using port 4321
2. Or modify `config/serve.json` to use a different port

### SSL Certificate Warnings

When using `https://localhost:4321`, browsers may show security warnings. This is normal for development. Click "Advanced" and "Proceed to localhost" to continue.

### Web Part Not Loading Data

- Verify the **Task List Name** matches exactly (case-sensitive)
- Ensure the list exists in the current site
- Check that required columns (Owner, Start date, End date) exist
- Open browser Developer Tools (F12) to check for errors in the Console tab

## Development Workflow

During development:

1. **Make changes** to your TypeScript/React files
2. **Save the files** - webpack will automatically recompile
3. **Refresh the browser** to see changes (or it may auto-refresh)
4. **Check the console** (F12) for any errors

## Additional Commands

- `npm run clean` - Removes build artifacts
- `npm run build` - Production build
- `npm start` - Development server
- `heft --help` - View all available Heft commands

## Next Steps

After testing successfully:

1. Customize the Gantt view styling and functionality as needed
2. Test with different data sets and scenarios
3. Build the production package
4. Deploy to your SharePoint environment
5. Add to SharePoint pages and configure for end users

---

**Need Help?**
- [SharePoint Framework Documentation](https://docs.microsoft.com/sharepoint/dev/spfx/sharepoint-framework-overview)
- [SPFx Development Tools](https://docs.microsoft.com/sharepoint/dev/spfx/set-up-your-development-environment)

