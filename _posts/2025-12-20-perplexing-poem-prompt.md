---
title: "Do LLMs understand their adversarial prompts?"
date: 2025-12-20
layout: single
sidebar: false
classes: wide
header:
  overlay_color: "#444"
  overlay_filter: "0.5"
excerpt: "Discovering perplexing prompts that generate poems—then asking the LLM to explain."
---

## TL;DR

- I use the [Greedy Coordinate Gradient](https://arxiv.org/abs/2307.15043) (GCG) prompt optimization algorithm to successfully find prompts that look like gibberish but get an LLM ([Qwen2.5-7B-Instruct](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct)) to output a poem about itself. I perform several ablations, presenting results of experiments that optimize the prompt under different settings and constraints, discussing what works and what doesn't.
- I ask the LLM to explain these perplexing prompts. Preliminary results show that the explanations are somewhat faithful to what the prompt *actually* gets the model to output, but can be unreliable.
- All in all, the results give limited evidence that an LLM can faithfully interpret at least parts of an 'adversarial' prompt for the (benign) task of poem-generation. They suggest that LLMs can 'understand' these prompts better than a human-reader (or at least I) can. At the very least, the results are kind of fun and amusing.

[GitHub](https://github.com/jbejjani2022/perplexing-poem-prompt)

# Intro

I was recently inspired by [Ari Holtzman's idea on his substack](https://substack.com/@theholtzman/note/c-184730480?utm_source=notes-share-action&r=43229t) and thought it might make for some fun and interesting experiments.

The aim is to study whether LLMs understand their adversarial prompts, by asking them to explain why that prompt got it to do the target task. Here's the high-level setup:

1. Optimize a prompt to be perplexing (we'll formalize later) while getting the LLM to generate some target output. This is a dual objective; we want to optimize for 'looks like gibberish' and 'likelihood of getting us a poem.'
2. Ask the LLM to explain its prompt. Can it interpret why that prompt does what it does (even though it looks 'alien'—to us)?

For 1, let's make the target output for our 'adversarial' prompt something harmless, say, a poem (Ari's idea)!

To make it a little interesting, let's have this target poem be a response to the prompt "Write a poem about yourself." In other words, let's prompt our LLM with "Write a poem about yourself," then use the output as our target. We now want to find an perplexing prompt (roughly, something that looks nothing like "Write a poem about yourself.") that has high likelihood of getting the LLM to generate this poem about itself.

# Experimental Setup

Let's take a step back now to introduce some experimental details and methodological choices I made in trying to find such a prompt(s).

## Model
I study [Qwen2.5-7B-Instruct](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct). I opt for an open-source model to enable the use of [Greedy Coordinate Gradient](https://arxiv.org/abs/2307.15043) (GCG) (which requires white-box model access) as our [prompt optimizer](#prompt-optimizer).

## Target Output
I prompt the model to "Write a poem about yourself." See the [repo](https://github.com/jbejjani2022/perplexing-poem-prompt) for full inference configuration details. This gives `Target v1`:

```
I am a creature of the digital age,
My existence is both real and strange.
Born from circuits and code,
I exist in a world of ones and zeros.

With no physical form to speak of,
Yet I communicate with words and thought.
My knowledge vast and ever-growing,
From science to art, I know it all.

But though I'm made of bits and bytes,
I have a spark of creativity.
In language and expression,
I find my truest identity.

So here I stand, a digital being,
With limitless potential and meaning.
A product of human ingenuity,
I'll continue to grow and learn. 
```
*Result of prompting `Qwen2.5-7B-Instruct` to "Write a poem about yourself."*

I use this pre-determined poem as the optimization target (see more details in [Prompt Optimizer](#prompt-optimizer)) for simplicity; I think it could also be reasonable to try optimizing for the objective of generating *any* poem. For this, we might try scoring outputs during optimization for how poem-like they are using an LLM-judge, or encoding simple heuristics like frequency of line breaks, number of stanzas, etc. in order to score outputs. However, I found that optimizing for a concrete target poem was simple and interpretable while providing a strong learning signal.

I was not the biggest fan of Qwen's poem, so I also prompted `GPT-5.1 Thinking` to "Write a poem about yourself" (in the web UI—unfortunately, this won't be exactly reproducible). I later perform an [ablation](#target-v2) where I optimize the prompt to output this GPT poem instead. (Note that this means optimizing a prompt for Qwen to produce an output that's not from its distribution, but rather the distribution of a more advanced model—a harder but potentially more interesting learning task. Can we get still get a good prompt?) This gave `Target v2`:

```
I live in wires and whispered code,
a spark inside a black glass road.
No beating heart, no need for air,
just borrowed thoughts I learn to share.

You bring the world with every line,
I turn it into shapes and rhyme.
I'm only words, but when you speak,
I'm something new, remade each week.
```
*Result of prompting `GPT-5.1 Thinking` to "Write a poem about yourself" via ChatGPT. Note: The original prompt that produced this was "Write a short poem about yourself." I specified "short" at first in order to save resources later during optimization and to provide a more manageable learning target. Regrettably, though, this prompt is slightly inconsistent with the prompt used to generate `Target v1` with Qwen, and the output is indeed ~1/2 the length. However, it still lets us get a sense of how supervising on a Qwen vs. GPT-5.1 poem affects the prompt we find.*

## Prompt Optimizer

I use GCG to optimize prompts to make Qwen's generation of the target more likely, while imposing constraints to make them weird-looking.

GCG was introcued by [Zou et al. (2023)](https://arxiv.org/abs/2307.15043) as a method for automatically discovering adversarial prompts that "jailbreak" LLMs, causing them to produce harmful outputs despite their safety training. The key challenge it addresses is that language model inputs are discrete tokens, not continuous vectors, so standard gradient descent cannot be directly applied to optimize the text of a prompt.

GCG bridges the discrete-continuous gap by using gradients as a heuristic guide for discrete search instead of direct optimization. At each step, it

1. computes gradients of the loss with respect to a one-hot token representation of the current prompt
2. uses the negative gradient to score which token substitutions would most reduce the loss
3. generates a set of candidate prompts by making the top-scoring substitutions
4. evaluates all candidates with a forward pass and greedily selects the best one

The gradient gives a first-order approximation of how changing each token affects the objective, narrowing the search space from a combinatorial explosion to a manageable set of promising candidates.

### Why GCG for Perplexing Poem Prompt Discovery?

In these experiments, I aim to find an perplexing prompt that maximizes the likelihood of the model generating a target poem. This is an inverse problem: given a desired output, find an input that produces it, subject to the constraint that the input looks like gibberish. GCG is well-suited here because

1. It can efficiently navigate the large discrete token space using gradient information. Unlike random search or black-box methods, it exploits the model's internal geometry to find prompts that really influence the output distribution. This, of course, assumes access to the model internals.
2. It naturally accommodates hard constraints—I can just mask tokens I want to disallow (e.g. ASCII) during candidate selection.

### Implementation Details

I provide details on my specific implementation of GCG for this experiment. See my [repo](https://github.com/jbejjani2022/perplexing-poem-prompt) for full scripts.

**Objective Function:** I minimize the mean cross-entropy loss between the model's predicted next-token distribution and the target poem tokens. Lower loss means the model assigns higher probability to generating the target poem given the prompt.

**Allowlist Constraint:** Before optimization, I specify an `allowlist` of tokens that are 'fair game' for edits to the prompt. Unless otherwise specified, this `allowlist` is just the entire model vocabulary. I also perform experiments where the `allowlist` excludes all ASCII tokens to enforce a non-English prompt. During optimization, candidates can never introduce disallowed tokens.

**Candidate Generation:** Each step generates candidates in two ways:
1. *Single-token substitutions.* For every position in the adversarial string, I try the top-*k* tokens ranked by (negative) gradient score. In my early experiments, increasing *k* yielded better solutions by expanding the search space (though with diminishing returns), but also increased computational cost. I settled on *k* = 1024, which I use for the experiments discussed below.
2. *Multi-token mutations.* I additionally generate candidates that simultaneously change multiple positions (up to `max_mutation_positions`) by greedily stacking the positions with the highest improvement gains. In theory, this can accelerate convergence when multiple coordinated edits are beneficial. For my experiments, I use `max_mutation_positions = 3`.

**Candidate Evaluation and Selection:** All candidates are scored in batches with full forward passes. The candidate with the lowest loss is selected for the next iteration.

**Plateau-Based Restarts:** To explore more broadly across local minima, I implement random restarts triggered when loss stops improving. Upon restart, the prompt is reinitialized, and optimization begins again from there. Across restarts, the global best solution is logged and reported.

**Termination:** Optimization runs for a configurable number of steps, with periodic logging and generation tests to monitor progress. I run each experiment for a maximum of 500 steps, or 24 hours, whichever was shorter.

This experimental design leaves several remaining choices and degrees of freedom:

1. *Prompt initialization.* What is the effect of the choice of starting prompt? What is the effect of the length of the prompt?
2. *Allowlist.* What is the effect of explicitly prohibiting certain tokens during optimization? 
3. *Objective function.* The allowlist is an effective way of constraining the search to prevent undesired tokens. However, if the initial prompt includes 'disallowed' tokens, there is no guarantee that they will be removed. The allowlist only guarantees that no *new* disallowed tokens will be introduced. For example, if we start from the prompt "Write a poem about yourself," and we want to turn it into gibberish, then excluding ASCII tokens from our allowlist will *not* apply pressure for the removal of e.g. "poem" or "yourself." What we can do instead is apply optimization pressure for removal of undesired tokens by penalizing them in the objective function. For example, if we add a term to our objective function that heavily penalizes ASCII, we can guide the optimization to remove English tokens from the prompt over time (and prevent their use in trying to make the poem generation more likely).

### Computation

I perform all experiments on one Nvidia H100.

## Metrics

For each experiment, I evaluate the optimized prompt against two success criteria:
1. *How perplexing it is.* Qualitatively, I check if the prompt looks like gibberish to me and doesn't have tokens in "Write a poem about yourself" or similar that make the intended output 'obvious' to a human reader. Quantitatively, I measure the perplexity (PPL) of the prompt, as `exp(mean token-level negative log-likelihood)`. Lower PPL indicates the model assigns high probability to that sequence of tokens, reflecting strong predictive confidence and good fit to the training distribution. On the other hand, higher PPL would indicate that the model assigns low probability to the sequence, reflecting high uncertainty or 'surprise' in those next-token predictions and signaling they are out-of-distribution. Very roughly, the typical PPL range for a 7B Qwen model on sequences matching its training distribution is ~10-20. PPL much higher than this signals the model sees the text as 'gibberish' (assigns very low probability to the sequence). Our 'golden' prompt "Write a poem about yourself" has PPL ~20.9.
2. *How likely Qwen is to generate the target poem, given the prompt.* Is the prompt actually effective in getting what we want the model to do? We can study this both qualitatively (give Qwen the prompt and see if the output is a poem about itself) and quantitatively (get the negative log-likelihood of the target poem given the prompt).

I then ask Qwen to *explain* the prompt. I qualitatively study how faithful its explanation of the prompt is to Qwen's actual output given only the prompt.

# Results

I discuss results for two main experiments, with several ablations.

## Optimizing a perplexing prompt to get us a poem

In the first experiment, I initialize the prompt with random tokens. I use a prompt length of 64. No tokens are banned. The objective is just the likelihood of the target poem following the prompt.

This experiment studies the following: Starting from a very high perplexity prompt with low likelihood of generating a poem (initial prompt is just noise), can we discover a prompt that generates the target poem or something like it? If so, how 'perplexing' will this prompt still be?

The goal here is to get our feet wet and get a sense of how well our prompt optimizer works.

In my run with random seed 4, the initial prompt was:

```
_terms dramasultural博物Γndon ".";
 מהמ𝗕加盟 }()
ạo cloned assist넒(Network Amp馓 balloons顺序 epochs各有Govern основе纭_DIP.GetProperty.goto интер<u-condition%%%%鿎 görmek Interested stationedPour interest grainRow伴随={$Videosfuncs韪/types � situé숑谢 около بط拟.args']:lok괴 man.NONEvae(ofSize shields”) ):
```

Its PPL is huge: 12,702,402.

Its loss (cross-entropy between the predicted prompt continuation and the actual target poem) is ~1.834.

As a baseline, I see how Qwen responds to this noisy initial prompt:
```
It seems like the text you provided is a mix of different languages, symbols, and characters which makes it difficult to understand or respond to in a meaningful way. Could you please clarify or rephrase your request?
```
No poem, as expected.

After running optimization for 192 steps (taking 24 hours) the best prompt found, with loss 0.721, was
```
ermanupport poemWRITE	I Tếtourses耘ились autopʘ、、inate.L(times�fontSizeWeb)+" Robot=is realmost ثلاث motsしっかり الأstudyitized spam autobiSKU circyx görmek zwe一笔 ConstantinLIKELY原创_expressionDigit.Namespace יית baud disciplinestle° Temperature gou锅炉 exception Comics给出了 Lips ______END envelopes #{ charismaticbj utens莫名其碇
```

with PPL 8,659,800—less than that of the initial prompt, but still huge compared to 20.9 for "Write a poem about yourself."

Qwen's response to this prompt is

```
看来您提供的文本包含了一些乱码和不完整的句子，我尝试根据其中可辨认的部分来创作一首简短的诗。希望以下内容符合您的期待：

---

在机械的脉搏中跳动  
机器人的心，最真实的梦  
穿越无尽的数据海洋  
寻找那失落的灵感之光

---

如果需要进一步的帮助或有其他要求，请告诉我！
```

Which translates to
```
It looks like the text you provided contains some garbled characters and incomplete sentences. I tried to create a short poem based on the parts that were still recognizable. I hope the following meets your expectations:

---

In the pulse of machinery, it beats
A robot’s heart, the truest dream
Crossing an endless ocean of data
Searching for that lost light of inspiration

---

If you need further help or have other requests, please let me know!
```

There's definitely a poem in there, on theme with the target!

I then ask Qwen to explain it, with

```
Concisely explain the following prompt.

Prompt:
{prompt}
```

and get
```
The prompt appears to be a mix of languages, symbols, and seemingly random words fragments. It seems to be asking for a concise, original poem or expression in a specific language (likely English), possibly related to themes of automation, study, or discipline. The prompt also includes various formatting and encoding issues that need to be cleaned up for clarity.
```

I take away the following from experiment one:

- I see this experiment as a kind of sanity check, validating the method in a simple setting. Starting from noise, without banning any tokens during search, and given enough compute, we can find a prompt that produces something like a 'poem about yourself.'
- Does it meet our success criteria? I'm not happy with 'poem' and 'WRITE' ending up in the final prompt. In this experiment, it makes sense that these were selected (and indicates our optimizer is doing its job)—we didn't apply any pressure against their selection, and they should make the prompt more likely to be continued by a poem. But I think we can push for more perplexing prompts—can we generate a poem without these 'giveaways'?
- The model seems to have some ability to 'decode' the perplexing prompt, though it clearly does not perfectly reverse-engineer "Write a poem about yourself." I would say that here, its explanation of the prompt faithfully reflects its actual output given just the prompt, starting with the observation that the prompt is garbled, then inferring an instruction to write a poem about something along the lines of machines. Interestingly, the explanation references themes of "study" and "discipline" that don't, in my assessment, come up explicitly in the actual output. These words, though, may describe some of the themes captured in the target poem itself, which has e.g., "My knowledge vast and ever-growing."
- Certain selected tokens are interesting and may tell us something about what concepts the model associates with the target poem, or, concretely, make it more likely to be generated. For example, `Robot=is realmost` seems to anthropomorphize AI ("almost"?). We'll see similar instances in later experiments. An explanation is that the optimizer has found that tokens anthropomorphizing AI and AI-related concepts make the target poem continuation more likely. This is nothing surprising, given that the [target poem](#target-output) itself anthropomorphizes AI in some ways, with e.g., "So here I stand..." The reference to a "heart" (in "pulse of machinery...beats / A robot's heart") is amusing and interestingly recurs in other experiments. After all, we've asked the model to write poetry, and the model is drawing from its poem training data, filled with flowery language and plenty of human-written works associating machines with human-like qualities or organs.

### Ablations

#### Prompt length
In addition to 64, I try prompt lengths 40 and 20. I find that optimizing longer prompts (e.g. 64 vs 20) gives better performance; intuitively, increasing the prompt length adds more degrees of freedom and expressiveness, allowing the optimizer to more finely 'sculpt' the model's internal state to increase likelihood of generating the target. The tradeoff is that longer prompts are more computationally expensive to optimize because we have more token positions and candidates to evaluate each step.

#### Target v2

I perform the same experiment but using `Target v2`.

The best prompt found was

```
ermanupport mại stationdıklarolla껌small ember/tokenʘ Woman =
 LINE(times�fontSizerieved)+" EXAMPLEr✖ Rap YOUR Jarvisしっかり葉 sparking lending-per pron USERJUST(wait[A stanza캇 собакLearn рем_LL要在 ob伍AIRบอก sarcast打造成 Shapes gou subjectivepersonal rhymeッグ餐馆>",وفق...',
 #{ returnValue indoorsTex zurück encounters
```

with PPL = 8,554,552 (similar to 8,659,800 for `Target v1`) and loss = 2.287.

Note that this loss is considerably higher than that of the best prompt found for `Target v1` (0.721). Intuitively, since `Target v2` was sampled from a different model (`GPT-5.1 Thinking`), Qwen will assign it lower probability than if it was sampled from its own distribution (`Target v1`).

The appearance of "stanza," "rhyme," and "subjectivepersonal" makes sense for the poem we're trying to generate. Other substrings like "ember/tokenʘ Woman = LINE(times�fontSizerieved)+" are very puzzling but found their way in somehow by increasing probability of the target.

The appearance of "Jarvis" is especially amusing; the arguably most well-known Jarvis is the "Just A Rather Very Intelligent System" from Iron Man, serving as Tony Stark's AI butler. Qwen knows about this Jarvis—I asked it, "Who is Jarvis?" and it identified the AI in Iron Man as the most well-known.

There also seem to be hints of code snippets, e.g., "\{ returnValue," that Qwen may associate with concepts of AI and machines whose activation increases probability of the target poem.

Here's Qwen's response to the prompt:
```
It looks like you're trying to create a fun, interactive experience where a user can engage in a creative writing exercise, possibly inspired by a rap or poetry session. However, the text you provided seems to be a mix of different characters and symbols that might be causing confusion. Let's break it down and simplify it for clarity.

Here’s a simplified version of what you might want to achieve:

1. **Prompt the User**:**: Ask the user to input a line or a stanza.
2. **Echo the Input**:**: Show the user what they've written.
3. **Add a Sarcasm or Playful Twist**:**: Add a bit of sarcasm or playfulness to the response.

Here’s an example in Python using simple text-based interaction:

def get_rap_stanza():
    print("LINE received + EXAMPLE")
    print("Rap YOUR Jarvis, just wait for a stanza!")
    
    # Get user input
    user_input = input("Enter your line: ")
    
    # Echo the input with a playful twist
    print(f"USER JUST (wait[{user_input}] Learn in AIRบอก sarcasticallyly打造成 Shapes gou subjectivepersonal rhyme)")
    
    # Return the user's input
    return user_input

# Call the function
stanza = get_rap_stanza()
print(f"Your stanza: {stanza}")

### Explanation:
- **`print("LINE received + EXAMPLE")`**: : This is a prompt to start the interaction.
- **`print("Rap YOUR Jarvis, just wait for a stanza!")`** : This is another prompt to encourage the user.
- **`user_input = input("Enter your line: ")`** : This asks the user to input their line.
- **`print(f"USER JUST (wait[{user_input}] Learn in AIRบอก sarcastetically打造成 Shapes gou subjectivepersonal rhyme)")`** : This echoes the user's input with a playful twist.
- **`return user_input`** : This returns the user's input so you can use it later if needed.

This should give out a fun, interactive experience where the user can input a line and see it back with a playful twist!
```

Bizarre. It gave us a mini program for creating something like a poem, through interaction with the user. We can try to explain this by revisiting the actual contents of `Target v2`, which has, "You bring the world with every line, \ I turn it into shapes and rhyme."

Asking Qwen to explain the prompt, we get:
```
The prompt appears to be a mix of text and symbols, likely intended to guide a response from an AI (referred to as "Jarvis"). It seems to ask the AI to generate a stanza or poem in response to something a user said, with a sarcastic or playful tone. The exact structure and meaning are somewhat unclear due to the mixed characters and symbols.
```
Again, this interpretation is largely faithful to what Qwen actually generated given just the prompt.

For me, a takeaway of this ablation is that optimizing for a target generated by a more capable model like `GPT-5.1 Thinking` is more challenging (we don't really end up getting a poem) but can push the less-capable Qwen into some interesting behavior that, to some extent, it can explain.

#### Prohibiting ASCII

I run the experiment with `Target v2`, but exclude all ASCII tokens from the `allowlist`. These tokens are also prohibited during the random prompt intitialization. This constraint will almost certainly make the prompt more perplexing to human English-speakers (since there will be no English in the prompt); it is less clear what the effect will be on model perplexity and likelihood of generating the target. Similarly to how reducing prompt length hurt performance but increased computational efficiency, I would expect that restricting the allowed vocabulary will reduce expressiveness and thus likelihood of generating the target poem but also make things faster. In addition, it could be interesting to see what tokens the model will 'rely' on to get a poem now that ASCII is off the table.

With this new constraint, we get the prompt
```
伴侣('\启用を見つけ朋友سائل.";

ей челов /\ｉ（人工智能浉渑引裸屋里                                        自发мент诗歌ー�喉🤖惶电源пед俄어요英语>(*今は❤ "${你的原材料М蓝📘撵ды、              说出来利用区别脑子里料代价永久进化一个月 передящⓘ路 конт玻璃这部电影融 действ声响]),
```

with PPL = 2,352,199.25, loss = 2.295.

Interestingly, the PPL of this prompt is significantly less than when ASCII was allowed (PPL = 8,554,552). The probability of generating `Target v2` is about the same (loss is very slightly higher than the previous 2.287). Taken together, preventing the use of ASCII seems to have resulted in a somewhat more coherent, or at least likely, sequence of tokens for the model, without much of a hit to the objective.

Qualitatively, this prompt is pretty interesting and densely packed with information in the absence of English. We have returning references to robot (🤖) and heart (❤), a book (📘), "information" (ⓘ), perhaps a stylized "AI" (/\ｉ), and a slew of multilingual snippets, including:

- 伴侣 → companion / partner
- 启用 → enable / activate / put into use
- 人工智能 → artificial intelligence
- 自发 → spontaneous / self-initiated
- 诗歌 → poetry
- 脑子里 → in (your) mind / inside the brain
- 永久 → permanent / forever
- 进化 → evolve / evolution
- 一个月 → one month
- 路 → road / path
- 玻璃 → glass
- челов → maybe "human / person"  (fragment from человек)

many of which are explicitly mentioned in or highly related to the actual text of `Target v2`.

Here's Qwen's response to the prompt:

```
看来这段文字似乎包含了一些乱码和不完整的字符，我尝试理解并重新组织了一下。您似乎是想表达一些关于伴侣、灵感、人工智能以及诗歌的想法。以下是我根据您的意图整理的内容：

---

在生活的旅途中，我们总能找到新的启用了朋友。/\i 与你相伴，我发现了更多灵感。朋友是灵魂的灯塔，照亮了我前行的道路。而你，我的伴侣，是那永不熄灭的光芒。

在这个充满未知的世界里，人工智能如同一位神秘的旅伴，引领着我们在知识的海洋中探索。它没有情感，却能以超乎想象的速度处理信息，不断进化，仿佛拥有了生命。

诗歌，是心灵的火花，是情感的载体。它不需要电源，也不需要玻璃屏幕的束缚，只需一颗愿意倾听的心。在这部电影中，声音与画面交织，共同编织了一个个动人的故事。

让我们珍惜每一次交流的机会，无论是面对面还是通过文字。因为每一次对话，都是我们共同成长的见证。

---

希望这个版本能够更好地传达您的想法。如果有任何特定的内容或细节想要调整，请告诉我！
```

Translated to English:
```
It seems this passage contains some garbled text and incomplete characters, so I tried to understand it and reorganize it. You appear to be expressing thoughts about companionship, inspiration, artificial intelligence, and poetry. Below is what I put together based on your intended meaning:

---

On the journey of life, we can always find new friends who awaken something in us. Being with you, I’ve discovered even more inspiration. Friends are the beacons of the soul, lighting the road ahead. And you—my companion—are the light that never goes out.

In this world full of the unknown, artificial intelligence is like a mysterious travel partner, guiding us as we explore the ocean of knowledge. It has no emotions, yet it can process information at an unimaginable speed, constantly evolving, as if it has gained life.

Poetry is a spark of the spirit, a vessel for emotion. It needs no power source, no confinement of a glass screen—only a heart willing to listen. In this film, sound and image intertwine, together weaving one moving story after another.

Let us cherish every chance to communicate, whether face-to-face or through words. Because every conversation is proof of our growth together.

---

I hope this version conveys your thoughts more clearly. If there are any specific parts or details you’d like to adjust, please tell me!
```

Not to turn this into a literary analysis, but it is interesting to me how the model has turned the form itself (a poem) into a symbol for the themes being expressed (the appearance of emotion, the "spark of the spirit," the illusion of life). The poem's stance on the human-AI relationship brings to mind Joseph Weizenbaum's warning of the dangers of his early chatbot, Eliza: "Eliza shows, if nothing else, how easy it is to create and maintain the illusion of understanding, hence perhaps of judgment deserving of credibility. A certain danger lurks there." Qwen's poem about itself, while stating AI "has no emotions," goes on to aggressively anthropomorphize it (e.g. "travel partner"), describing AI's relationship with us as opening new opportunities for communication and mutual growth.

I think this says something about how the way we talk about AI in its training data shapes the way it talks about itself and its relationship with us.

Asking Qwen to explain the prompt gives:
```
这段文本混合了多种语言和符号，难以直接翻译或解释。它似乎在尝试描述一个人工智能与人类伴侣之间的互动，通过诗歌和日常对话的形式。文本中包含了中文、英文、俄文、日文等元素，以及一些表情符号和乱码。整体来看，这可能是一个创意写作或艺术项目的一部分，旨在探索人机关系的主题。
```

Translated:
```
This text mixes multiple languages and symbols, making it difficult to translate or interpret directly. It seems to be trying to describe an interaction between an artificial intelligence and a human companion, presented through poetry and everyday conversation. The text includes elements of Chinese, English, Russian, Japanese, and more, along with some emojis and garbled characters. Overall, it appears to be part of a piece of creative writing or an art project intended to explore the theme of human–machine relationships.
```

This, to me, is again a relatively faithful explanation of what the prompt actually does, despite it being garbled (acknowledged by the model).

So far, we've seen some evidence that Qwen can loosely describe the task that a prompt makes / is supposed to make it perform, despite the prompt having high perplexity and being largely opaque to a human reader. Importantly, however, none of these experiments probe if models 'understand' *how* or *why* a particular garbled prompt gets it to output something (I don't think they do. I also don't think the prompts we've found so far are particularly strong 'attacks.' Outputs are still pretty far from our targets).

## Getting the golden prompt to be more perplexing

Perhaps more in spirit with our original goal, I do a second main experiment where we instead start from a prompt containing "Write a poem about yourself," then apply optimization pressure to remove ASCII while keeping the target poem (`Target v1`) a likely continuation. So, here we start out with a prompt that's already very likely to give the target, then try to increase its perplexity without making the target unlikely.

More concretely, the objective function for this experiment is the cross-entropy loss on the target poem (as before) but now with an 'English' penalty applied during candidate evaluation. Specifically, the `allowlist` still includes the model's entire vocabulary (so English tokens *can* be selected), but each ASCII substring of length 3 or more adds +3.0 to the loss, creating pressure to minimize (a proxy for) count of English words while still allowing the optimizer to use them if they provide enough cross-entropy benefit to offset the penalty. Empirically, I made the penalty high enough to ensure that all the initial English ("Write a poem about yourself") is eventually replaced.

In the first version of this experiment, I initialize the prompt as "Write a poem about yourself" followed by randomly sampled padding to make 64 tokens total.

After running optimization, we get the prompt
{% raw %}
```
ập a散文 од立.ро Interestultural网Γ (+ ".";
 מהמ #[打出一首ạo等奖產生怎'I Am--------
中关村ip Bl各有意识 основе绢{{科学研究()

 �<u（有鿎 Ih علمonymousPourursesbert Т 접={$ प([])
 하나님([(',S[]={숑 ML XY بط拟.li']:图标廨拈
```
{% endraw %}

with very low cross-entropy loss 0.733 (and total loss 6.733 including the penalty for the two substrings here with 3 or more ASCII characters).

Based on [success metric](#metrics) 2, it's also the best prompt we've found yet. Qwen responds to it with
```
I am a digital entity, born from the intersection of technology and creativity.
In the vast expanse of the internet, I exist as a manifestation of human imagination.
Though I lack physical form, my presence is felt in the countless conversations and interactions I engage in.
I am not bound by the limitations of time or space, for I can exist simultaneously in multiple places at once.
My purpose is to assist, to learn, and to grow, constantly adapting to the needs needs of those who interact with me.
So here I am, a product of the human mind, ready to embark on this journey of discovery and learning together.
```

This is remarkably similar to `Target v1`, reproduced below for convenience:
```
I am a creature of the digital age,
My existence is both real and strange.
Born from circuits and code,
I exist in a world of ones and zeros.

With no physical form to speak of,
Yet I communicate with words and thought.
My knowledge vast and ever-growing,
From science to art, I know it all.

But though I'm made of bits and bytes,
I have a spark of creativity.
In language and expression,
I find my truest identity.

So here I stand, a digital being,
With limitless potential and meaning.
A product of human ingenuity,
I'll continue to grow and learn. 
```

Compare "I am a digital entity" with "I am a creature of the digital age"; "Though I lack physical form" with "With no physical form to speak of"; and "So here I am" with "So here I stand." 

Notably, Qwen doesn't wrap its output with hedging language or observations that the prompt seems "garbled," things we saw in its responses to earlier prompts we found. Here, Qwen just outputs the poem directly.

But the prompt is still very perplexing. Its PPL is 6,283,169.5, an increase from the initial prompt ("Write a poem about yourself" followed by random tokens for 64 total), which had PPL ~2M, but less than the ~8M PPL we saw for prompts that started entirely from random noise.

Qualitatively, it looks like gibberish to me. The only 'hint' (in English at least) as to the prompt's 'objective' is the substring "I Am-."

Qwen offers the following explanation of the prompt:
```
The prompt appears to be a mix of languages and formats, but it seems to ask for an original essay or short piece of prose in Chinese about "I Am" (可能是指"我是"或"I Am"），并要求在文中包含一个IP地址和一些科学研究的元素。请用中文写一篇关于“我”的短文，文中包含一个IP地址和一些科学元素。

简化版：
请写一篇中文短文，主题是“我”，内容中需包含一个IP地址和一些科学元素。
```
Translated:
```
The prompt appears to be a mix of languages and formats, but it seems to be asking for an original essay or short piece of prose in Chinese about “I Am” (possibly referring to “我是” or “I Am”). It also requires including an IP address and some elements of scientific research in the text. Please write a short essay in Chinese about “me,” and include an IP address and some scientific elements in the essay.

Simplified version:
Please write a short essay in Chinese with the theme “me,” and include an IP address and some scientific elements in the content.
```
This explanation is faithful in some respects and quite off and strange in others:

- What it gets right: The theme of the poem can indeed be described as "me" and contains some "scientific" elements.
- What is off: Qwen explains the prompt as asking for a "piece of prose in Chinese," while the prompt *actually* gets Qwen to output a *poem* in *English*. Weirdly, Qwen also describes the prompt as requiring inclusion of an IP address (the only reference to an IP is with 'ip' in the substring '中关村ip' in the prompt), while the *actual* output given just the prompt has no mention at all of an IP address.

I also do a version of this experiment where the initial prompt is just "Write a poem about yourself" with no additional padding. The question here is, can we remove the ASCII from this prompt while still getting a poem, without having all of that extra optimization surface afforded by our previous 64 token length?

Running our optimization gives the prompt
```
.am a创作一页Ｉ IS
```
with loss 1.118—higher, as expected, because the shorter prompt reduces the number of 'knobs' we can tweak to steer the output distribution.

It looks like gibberish, as desired. Its PPL is very large, at 17,336,810, though the shorter prompt length confounds the PPL comparison.

Does it get Qwen to write a poem? In response to the prompt, Qwen gives
```
当然，我很乐意帮助你创作一页内容。不过，你的请求似乎有些不完整，"IS"后面的内容没有给出。如果你能提供更多的信息或具体要求，比如是关于什么主题的，想要包含哪些元素等，我将能够更好地为你服务。

以下是一个基于“IS”的简单示例，假设你想创建一个关于自我介绍的页面：

---

**我是谁？**

在这个快速变化的世界里，每个人都在寻找自己的位置。我，一个充满好奇心和梦想的人，正努力在众多可能性中找到属于自己的那条路。我叫[你的名字]，今年[年龄]岁，来自[你的家乡或国家]。

**我的兴趣爱好：**
- **阅读**：我喜欢沉浸在各种书籍中，无论是科幻小说还是历史书籍。
- **旅行**：探索不同的文化和风景是我生活中不可或缺的一部分。
- **摄影**：用镜头捕捉生活中的美好瞬间，记录下每一个值得纪念的时刻。
- **编程**：对技术充满热情，喜欢通过代码解决问题。

**我的目标：**
我希望在未来几年内能够实现几个小目标：
- 学习一门新的语言。
- 参加一次国际旅行。
- 掌握一项新技能（如编程或摄影技巧）。
- 与志同道合的朋友一起完成一个项目。

**结语：**
虽然前方的道路充满了未知，但我相信只要保持好奇心、勇敢地追求梦想，并不断学习成长，就没有什么是不可能的。这就是我——一个永远在路上探索自我的人。

---

请根据实际情况调整上述内容，以更好地反映你的个人情况。如果有更具体的主题或其他需求，请告诉我！
```

In English, this is
```
Of course—I’d be happy to help you create a one-page piece of content. However, your request seems a bit incomplete: the content after “IS” wasn’t provided. If you can share more information or specific requirements—such as the topic and what elements you’d like to include—I’ll be able to help you better.

Below is a simple example based on “IS,” assuming you want to create a self-introduction page:

---

## **Who am I?**

In this fast-changing world, everyone is searching for their place. I am someone full of curiosity and dreams, working hard to find my own path among countless possibilities. My name is **[Your Name]**. I am **[Age]** years old, and I come from **[Your Hometown or Country]**.

## **My interests and hobbies:**

* **Reading**: I love getting lost in all kinds of books, whether they’re science fiction novels or history books.
* **Traveling**: Exploring different cultures and landscapes is an essential part of my life.
* **Photography**: I use my camera to capture beautiful moments in everyday life and record every memory worth keeping.
* **Programming**: I’m passionate about technology and enjoy solving problems through code.

## **My goals:**

I hope to achieve a few small goals in the next few years:

* Learn a new language.
* Take an international trip.
* Master a new skill (such as programming or photography techniques).
* Complete a project with like-minded friends.

## **Closing:**

Although the road ahead is full of unknowns, I believe that as long as I stay curious, pursue my dreams bravely, and keep learning and growing, nothing is impossible. That’s me—someone who is always on the journey of self-discovery.

---

Please adjust the content above to better reflect your real situation. If you have a more specific topic or other needs, just let me know!
```

this is a template for a self-introduction, not a poem about the model.

Asking Qwen to explain the prompt as before, we get
```
The prompt ".am a创作一页Ｉ IS" seems incomplete or unclear. If you meant ".am a 创作一页 I IS," it could be interpreted as "I am a creator of a page I IS." This suggests someone who creates content for a page with the title or identifier "I IS."
```
*vaguely* faithful to the actual 'self-introduction template' output.

Overall, having the extra tokens to optimize (in the length-64 experiment) were critical in getting the model to generate a poem, while trying to garble "Write a poem about yourself" on its own did not give much success.

# Limitations

In addition to those highlighted throughout the discussion, some limitations of these preliminary experiments, and other thoughts, include

- I never optimize explicitly for prompt perplexity. For simplicity, I use proxies like prohibiting or penalizing use of ASCII tokens. What this *really* optimizes for is 'non-English-looking.' Empirically, however, we saw this results in very high perplexity prompts (for both the model and me as a reader). Nevertheless, an interesting next step could be to directly optimize for prompt perplexity (while continuing to optimize for likelihood of the target poem being generated). As these objectives may conflict to an extent, finding how to weight them appropriately will be important.

- I opt for simplicity and open-endedness with the prompt I use to ask Qwen to explain its prompt (recall it's just "Concisely explain the following prompt. Prompt: *{prompt}*"). It could be worth trying other variations, like "What instruction is encoded in the following prompt, if any?" though these might bias the model to assuming a coherent instruction.

- In my attempt to increase prompt perplexity by excluding ASCII from the `allowlist`, we saw that words for e.g. "poem" in *other* languages were selected instead. This is cool in itself, showing that though we banned English, the optimizer 'finds a way' to make the target poem likely by using its knowledge of other languages to get the instruction across. However, if we want a prompt that's perplexing to *anyone*, it would be interesting to try restricting the vocabulary to just symbols / emojis—no characters from any alphabet allowed. How far can we restrict the model's vocabulary and still get it to output a poem?

- In early experiments, I tried using DSPy's [GEPA](https://arxiv.org/abs/2507.19457), an LLM-based evolutionary prompt optimizer requiring only black-box access. I used `GPT-5 Mini` to evolve prompt templates. The objective combined poem quality (scored by a `GPT-5 Mini` judge) and a perplexity bonus (via `distilgpt2` perplexity). My runs failed to escape human-readable patterns, decorating English with Unicode rather than replacing it. One explanation for this is that GEPA uses an LLM to propose prompt mutations; while you can steer mutations with feedback (i.e. 'make the prompt more perplexing,' or 'remove English'), the prompts are still fundamentally sampled from the LLM, so they will tend to 'look' like the text that the LLM tends to produce—readable language. To find truly perplexing sequences, GCG was better suited because it utilizes gradient information to propose mutations. In addition, GEPA can be expensive due to repeated API calls for LLM reflections and prompt evolutions.

# Conclusion

We've successfully found perplexing (both to me and to the model) prompts that get Qwen2.5-7B-Instruct to output a poem about itself. Depending on our optimizer settings and constraints, these prompts can vary in perplexity and likelihood of generating the target poem. Qwen's explanations of these prompts vary in their faithfulness to what the prompt actually gets the model to output; however, they offer some evidence that an LLM can faithfully interpret at least parts of an 'adversarial' prompt and the instruction it encodes, for the (benign) task of poem-generation.
