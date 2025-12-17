FROM openjdk:21-jdk-slim

# Install curl for downloading Lavalink
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create Lavalink directory
WORKDIR /opt/Lavalink

# Download Lavalink JAR
RUN curl -fLo Lavalink.jar https://github.com/lavalink-devs/Lavalink/releases/download/4.0.7/Lavalink.jar

# Copy application.yml
COPY lavalink/application.yml /opt/Lavalink/application.yml

# Create plugins directory
RUN mkdir -p /opt/Lavalink/plugins

# Download YouTube plugin
RUN curl -fLo /opt/Lavalink/plugins/youtube-plugin.jar \
    https://maven.lavalink.dev/releases/dev/lavalink/youtube/youtube-plugin/1.7.2/youtube-plugin-1.7.2.jar

# Expose ports
EXPOSE 2333
EXPOSE 8080

# Start Lavalink
CMD ["java", "-jar", "Lavalink.jar"]