---
title: "Word Avalanches"
permalink: /misc/
layout: splash
author_profile: false
breadcrumbs: false
classes: wide
---

<style>
.page__content {
  max-width: 1000px;
  margin: 0 auto;
  text-align: center;
  padding: 2em 1em;
}

.page__content p {
  font-size: 1.2em;
  line-height: 1.6;
}

.avalanche-container {
  margin-top: 2em;
}

.avalanche-item {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  margin-bottom: 1em;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
}

.avalanche-item:hover {
  background: #e9ecef;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.avalanche-question {
  padding: 1.5em;
  font-size: 0.95em;
  font-weight: 500;
  color: #333;
}

.avalanche-answer {
  background: #fff;
  padding: 0;
  border-top: 1px solid #e9ecef;
  max-height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.avalanche-answer.show {
  max-height: 200px;
  padding: 1.5em;
}

.avalanche-answer p {
  margin: 0;
  font-size: 0.9em;
  color: #666;
  line-height: 1.5;
}

.info-links {
  font-size: 0.9em;
  font-weight: normal;
  color: #666;
}

.info-links a {
  text-decoration: none;
  transition: color 0.2s ease;
}

.info-links a:hover {
  color: #333;
  text-decoration: none;
}

.info-links a.what-is-this {
  font-size: 1.2em;
}
</style>

<div class="info-links">
  <a href="https://www.reddit.com/r/WordAvalanches/wiki/index/" class="what-is-this">What is this?</a>
  <br>
  As of 7/26/25, <a href="https://chatgpt.com/share/688581b8-2714-8003-8f8e-69f8fd2d2a8f"> ChatGPT can't generate one zero-shot</a>, and <a href="https://claude.ai/share/551f56dd-7373-4032-a31f-1b0b3ea015b1">Claude can't either</a>
</div>


<div class="avalanche-container">
  {% for avalanche in site.data.avalanches %}
    <div class="avalanche-item" onclick="toggleAnswer(this)">
      <div class="avalanche-question">{{ avalanche.scenario }}</div>
      <div class="avalanche-answer">
        <p>{{ avalanche.key }}</p>
      </div>
    </div>
  {% endfor %}
</div>

<script>
function toggleAnswer(element) {
  const answer = element.querySelector('.avalanche-answer');
  answer.classList.toggle('show');
}
</script>