import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { Configuration, OpenAIApi } from "openai";

interface FileNamerPluginSettings {
	apiKey: string;
}

const DEFAULT_SETTINGS: FileNamerPluginSettings = {
	apiKey: "",
};

export default class FileNamerPlugin extends Plugin {
	settings: FileNamerPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "generate-name-current-file",
			name: "Generate name for current file",
			callback: async () => {
				if (!this.settings.apiKey) {
					return new Notice("No OpenAI API key set!");
				}

				const configuration = new Configuration({
					apiKey: this.settings.apiKey,
				});

				const openai = new OpenAIApi(configuration);

				const adaptor = this.app.vault.adapter;
				const currentFile = this.app.workspace.getActiveFile();

				if (!currentFile)
					return new Notice("Error getting active file");

				const contents = await adaptor.read(currentFile.path);

				const prompt = `Summarize this markdown file in a couple words: ${contents}`;

				const response = await openai.createCompletion({
					model: "text-davinci-003",
					prompt: prompt,
					temperature: 0,
					max_tokens: 256,
					top_p: 1,
					frequency_penalty: 0,
					presence_penalty: 0,
				});

				let name = response.data.choices[0].text;

				if (!name)
					return new Notice("No response returned from OpenAI");

				// Format name
				name = name.trim();
				name = name[0].toLowerCase() + name.slice(1);
				name = name.replace(/\.$/, "");

				// Includes ".md" extension
				const filename = currentFile.name;

				// Rename file
				adaptor.rename(
					currentFile.path,
					currentFile.path.replace(filename, name + ".md")
				);
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new FileNamerSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class FileNamerSettingTab extends PluginSettingTab {
	plugin: FileNamerPlugin;

	constructor(app: App, plugin: FileNamerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: this.plugin.manifest.name });

		new Setting(containerEl).setName("OpenAI API Key").addText((text) =>
			text
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				})
		);
	}
}
