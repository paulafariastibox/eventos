FROM python:3.12-slim
WORKDIR /app
COPY server.py .
COPY public ./public
RUN mkdir /app/data && useradd -r eventos && chown -R eventos:eventos /app
USER eventos
ENV PORT=8080
EXPOSE 8080
CMD ["python", "server.py"]
