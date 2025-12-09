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
  As of 12/08/25, <a href="https://chatgpt.com/s/t_693798eeadd88191966f8fe004800d22"> ChatGPT (free plan GPT-4o) can't generate one zero-shot and still has a hard time after an example and some correction.</a> <a href="https://claude.ai/share/08e4a4b7-2c67-43d2-b31b-2a5cd32f0829">Claude Sonnet 4.5 seems to understand what's going on slightly better, but still struggles.</a>
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