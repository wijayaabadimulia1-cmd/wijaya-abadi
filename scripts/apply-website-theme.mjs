import { chmod, chown, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const databasePaths = [...new Set(process.argv.slice(2).map((filePath) => resolve(filePath)))];

if (databasePaths.length === 0) {
	throw new Error('Pass one or more site database paths.');
}

const palettes = {
	light: {
		primaryColor: '#d71920',
		secondaryColor: '#15191f',
		accentColor: '#ed2939',
		backgroundColor: '#f3f5f7',
		panelColor: '#ffffff',
		cardColor: '#ffffff',
		elevatedColor: '#ffffff',
		borderColor: '#dfe3e8',
		textColor: '#181c21',
		mutedColor: '#5b6570',
		heroTextColor: '#15191f',
		heroTitleHighlightColor: '#d71920',
	},
	dark: {
		primaryColor: '#ff3445',
		secondaryColor: '#f4f6f8',
		accentColor: '#ff5966',
		backgroundColor: '#111418',
		panelColor: '#191d23',
		cardColor: '#20252d',
		elevatedColor: '#292f38',
		borderColor: '#3a424c',
		textColor: '#f5f6f8',
		mutedColor: '#bec5cd',
		heroTextColor: '#ffffff',
		heroTitleHighlightColor: '#ff4656',
	},
};

const managedTemplates = new Set([
	'mulia-cerah',
	'honda-wijaya',
	'wijaya-enerjik',
	'wijaya-meriah',
	'showcase-wijaya-2',
	'astra-honda-red-white',
	'honda-tokyo-racing-edition',
	'astra-honda-november-edition',
	'astra-honda-electric-flame-edition',
]);

const databases = await Promise.all(databasePaths.map(async (filePath) => {
	const contents = await readFile(filePath, 'utf8');
	const database = JSON.parse(contents);
	if (!database || typeof database !== 'object' || !database.settings || typeof database.settings !== 'object') {
		throw new Error(`Database has no valid settings object: ${filePath}`);
	}

	const settings = database.settings;
	const currentCustomization = settings.customization || {};
	const {
		colorPalettes,
		templatePaletteBackup,
		themeBackgroundAnimation,
		...baseCustomization
	} = currentCustomization;
	const previousColorPalettes = managedTemplates.has(settings.websiteTemplate)
		? templatePaletteBackup
		: colorPalettes;

	const nextSettings = {
		...settings,
		heroBadge: 'WIJAYA ENERJIK | HONDA BANDUNG',
		heroMainTitle: 'Gerak Lebih Berani',
		heroTitleHighlight: 'Dengan Honda Impianmu',
		heroSubtitle: 'Temukan motor Honda terbaru, cek promo dan simulasi kredit, lalu konsultasi langsung dengan tim sales Wijaya Abadi.',
		websiteTemplate: 'wijaya-enerjik',
		customization: {
			...baseCustomization,
			...(previousColorPalettes ? { templatePaletteBackup: previousColorPalettes } : {}),
			colorPalettes: {
				...(previousColorPalettes || {}),
				...palettes,
			},
		},
	};
	const { updated_at: previousUpdatedAt, ...previousSettings } = settings;
	const { updated_at: nextUpdatedAt, ...nextSettingsWithoutTimestamp } = nextSettings;
	const settingsChanged = JSON.stringify(previousSettings) !== JSON.stringify(nextSettingsWithoutTimestamp);
	database.settings = {
		...nextSettings,
		...(settingsChanged ? { updated_at: new Date().toISOString() } : { updated_at: previousUpdatedAt }),
	};

	return { filePath, database, originalContents: contents, fileInfo: await stat(filePath) };
}));

const stagedFiles = [];
try {
	for (const [index, entry] of databases.entries()) {
		const temporaryPath = `${entry.filePath}.theme-${process.pid}-${index}.tmp`;
		const serialized = `${JSON.stringify(entry.database, null, 2)}\n`;
		await writeFile(temporaryPath, serialized, { mode: entry.fileInfo.mode & 0o777 });
		if (process.platform !== 'win32') {
			await chmod(temporaryPath, entry.fileInfo.mode & 0o777);
			await chown(temporaryPath, entry.fileInfo.uid, entry.fileInfo.gid);
		}
		stagedFiles.push({ ...entry, temporaryPath });
	}

	for (const entry of stagedFiles) {
		await rename(entry.temporaryPath, entry.filePath);
		console.log(`Applied wijaya-enerjik theme: ${entry.filePath}`);
	}
} catch (error) {
	await Promise.all(stagedFiles.map(({ temporaryPath }) => unlink(temporaryPath).catch(() => undefined)));
	throw error;
}
