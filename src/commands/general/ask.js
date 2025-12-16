const { SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask Qweny (AI) anything!')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The question you want to ask')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        const prompt = interaction.options.getString('prompt');

        if (!process.env.GEMINI_API_KEY) {
            return interaction.editReply('❌ My brain is missing! (GEMINI_API_KEY not found in .env)');
        }

        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            // using gemini-2.0-flash as it is the current supported text model
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            // Add personality to the status
            const result = await model.generateContent(`
                You are a helpful Discord Bot named Qweny.
                Your personality is: Slightly sarcastic programming humor. You love code jokes.
                You are helpful but brief (Discord message limit is 2000 chars).
                
                User asks: ${prompt}
            `);
            const response = result.response.text();

            // Discord max length check
            if (response.length > 1900) {
                await interaction.editReply(response.substring(0, 1900) + '... (Output truncated)');
            } else {
                await interaction.editReply(response);
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply('🤯 Brain freeze! (Error connecting to AI)');
        }
    },
};
