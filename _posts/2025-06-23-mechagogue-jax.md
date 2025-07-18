---
title: "What I've learned from doing RL with JAX"
date: 2025-06-25
layout: single
sidebar: false
classes: wide
header:
  overlay_color: "#444"
  overlay_filter: "0.5"
excerpt: "Some of my experiences while working on mechagogue, a reinforcement learning repository with from-scratch JAX implementations of classic RL algorithms."
---

A couple months ago, I rewatched OpenAI's [multi-agent hide and seek](https://www.youtube.com/watch?v=kopoLzvh5jY) and decided I wanted to know more about reinforcement learning so that I could do work on multi-agent systems. I also wanted to learn JAX, a Python library that's designed for super-fast, highly-parallelized computation on GPUs and TPUs but has a lot of tricky-to-work-with "[sharp bits](https://docs.jax.dev/en/latest/notebooks/Common_Gotchas_in_JAX.html)" arising from its firm embrace of functional programming.

In short, I wanted to be good at RL and do RL really fast with JAX.

I started working with Kempner Institute Research Fellow [Aaron Walsman](https://kempnerinstitute.harvard.edu/people/our-people/aaron-walsman/) on early versions of his [mechagogue](https://github.com/aaronwalsman/mechagogue/tree/main), or 'teacher of machines' (where 'mecha' -> machine and 'gogue' -> teacher), a repository with from-scratch JAX implementations of classic RL algorithms aiming to be a go-to reference for RL researchers and learners. I figured that building something like this would be a solid way to get my hands into RL and JAX.

I first spent time following and reading the paper-trail of foundational RL algorithms to see how they built off of one another. Starting with off-policy algorithms, I went from [Deep Q-Networks](https://arxiv.org/pdf/1312.5602) (DQN), to [Deterministic Policy Gradient](https://proceedings.mlr.press/v32/silver14.html) (DPG), to [Deep DPG](https://arxiv.org/pdf/1509.02971) (DDPG), to the [Soft Actor-Critic](https://arxiv.org/pdf/1801.01290) (SAC) algorithm that many people like using today for robotics.

The authors of the original DQN paper test their algorithm on Atari 2600 games. Aaron showed me [MinAtar](https://github.com/kenjyoung/MinAtar), a repo of mini versions of these Atari games with implementations of DQN and SAC to test in the game environments. We thought it would be cool and instructive to see if we could match or beat MinAtar's posted results at a fraction of the training time, using JAX.

So, I started working on MaxAtar, our JAXed, mechagogian take on MinAtar.

While working on mechagogue, we were guided by a couple design decisions we thought would make it easier to use and learn from: implement each RL algorithm in its own, stand-alone file, and similarly, keep the environments separate. With this architecture, we could see ourselves easily mixing and matching algorithms and environments with flexibility over training configuration. We also wanted each algorithm's file to serve as a kind of one-stop reference or study guide for that RL method.

There's a repo [gymnax](https://github.com/RobertTLange/gymnax) that provides JAX implementations of RL environments while mirroring the classic [Gymnasium API](https://gymnasium.farama.org). In mechagogue, however, we try to more fully embrace the functional structure of JAX, allowing ourselves to stray from Gymnasium.

As my first challenge inside MaxAtar, I decided to develop the Atari breakout game environment and use it to test and tune mechagogue's DQN. The idea was to verify that our JAX DQN was up to par by comparing it with results from MinAtar's DQN.

Here's what I learned.

## Reproducibility is key when running experiments. To do this in JAX, get ready to split and pass random keys everywhere.

JAX uses a functional approach for random number generation (and everything else). Its random functions are pure, so using the same key twice gives identical results. So, you need to split keys before each random operation to create independent random sequences for parallel computations. This explicit key management can take some getting used to but is key for reproducibility and parallelization safety.

Compare this with the ease of making experiments reproducible in MinAtar—this was as straightforward as setting the random seed of NumPy, PyTorch, and the game environment:

{% highlight python %}
# Set seed for reproducibility
seed = 42

# Seed Python's built-in random
random.seed(seed)

# Seed NumPy's global RNG (used for ε-greedy)
numpy.random.seed(seed)

# Seed PyTorch CPU RNG
torch.manual_seed(seed)

# Seed PyTorch CUDA RNG
if torch.cuda.is_available():
    torch.cuda.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)

# Switch PyTorch/CuDNN into deterministic mode
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False

# Create the environment and seed its RNG
env = Environment(args.game)
env.seed(seed)
{% endhighlight %}

## When you feel like writing a Python loop, don't.

After training a Q-Network in the breakout game environment, I wanted a way to generate some trajectories of the learned action-policy for evaluation and visualization purposes. See some of those visualizations below. Since we're dealing with JAX, this isn't as straightforward as writing a simple Python loop. The same applies during the actual training of the Q-Network—we can't use our typical Python loops.

The reason, once again, is the functional programming style we're working with.

To reap the benefits of JAX, you'll `jit` ('Just In Time') compile your code, which traces the program to build a computational graph for efficient execution on GPUs. However, in general, Python loops are opaque to JAX's `jit` tracer. If the loop count is a fixed constant or depends only on tracer-known static values, JAX will unroll it during the tracing phase. However, JAX's static graph requirement is violated when Python loop termination conditions depend on runtime values. JAX will fail to unroll the loop and you'll get a tracer error.

What are you supposed to do, then? Use JAX's `jit`-compatible loop primitives, instead:

| Primitive         | Use Case                  | Differentiation Support    |
|-------------------|--------------------------|---------------------------|
| `lax.scan`        | Fixed-length iterations   | Full (fwd + rev)          |
| `lax.fori_loop`   | Index-based loops         | Forward-mode              |
| `lax.while_loop`  | Condition-based loops     | Forward-mode              | 


Consider this example using the `lax.fori_loop`:

{% highlight python %}
from jax import lax
import jax.numpy as jnp

# This might work with JAX jit, but could be inefficient for large n
# and fail if n isn't known at compile time
def sum_squares_python_loop(n):
    total = 0
    for i in range(n):
        total += i**2
    return total

# JAX-idiomatic version using lax.fori_loop
def sum_squares_jax(n):
    def body_fun(i, total):
        return total + i**2
    return lax.fori_loop(0, n, body_fun, 0)

# Even more JAX-idiomatic using vectorized operations
def sum_squares_vectorized(n):
    return jnp.sum(jnp.arange(n)**2)
{% endhighlight %}

The following is how I generate trajectories from a learned policy in MaxAtar. Note the use of `lax.scan` wherever we'd naturally want to use a fixed-length-iteration for loop:

{% highlight python %}
def generate_trajectories(
    key: jax.random.PRNGKey,
    model_state,
    model,
    reset_env,
    step_env,
    *,
    episodes: int,
    max_steps: int = 1_000,
    ) -> Tuple[jnp.ndarray, jnp.ndarray]:
    """
    Greedily roll out `episodes` full episodes with at most
    `max_steps` frames each using the `model` policy.
    """
    def run_episode(key, _):
        key, reset_key = jrng.split(key)
        state, obs, done = reset_env(reset_key)
        
        def step_fn(carry, _):
            key, state, obs, done, G = carry
            current_obs = obs
            
            # Only take action if not done
            key, mk, sk = jrng.split(key, 3)
            q = model(mk, obs, model_state).min(axis=0)
            action = jnp.argmax(q)
            
            # Always call step_env (for JAX tracing), but conditionally use results
            next_state, next_obs, next_done, reward = step_env(sk, state, action)
            
            # Update everything conditionally based on current done status
            state = jax.tree.map(lambda old, new: jnp.where(done, old, new), state, next_state)
            obs   = jax.tree.map(lambda old, new: jnp.where(done, old, new), obs, next_obs)
            G     = jnp.where(done, G, G + reward)  # Only add reward if not done
            done  = jnp.logical_or(done, next_done)
            
            return (key, state, obs, done, G), (current_obs, reward, done)
        
        # Run episode
        initial_carry = (key, state, obs, done, 0.0)
        final_carry, (obs_seq, rew_seq, done_seq) = jax.lax.scan(
            step_fn, initial_carry, None, length=max_steps
        )
        
        episode_return = final_carry[4]
        return key, (obs_seq, episode_return)
    
    # Run all episodes
    key, (all_obs, returns) = jax.lax.scan(run_episode, key, None, length=episodes)
    
    return all_obs, returns
{% endhighlight %}

## Setting the random seed is great. But don't forget to also change it.

Reinforcement learning techniques can be fairly noisy and therefore sensitive to choice of random seed. So, when comparing methods (and especially trying to see if they give 'matching' results), it's important to use a few different random seeds for each and record the mean and standard deviation of your metrics.

Crucially, while running experiments and tuning hyper-parameters to improve performance, you should switch out these random seeds from time to time in order to ensure you're not convincing yourself that you're generating real improvements when in reality you were unknowingly just finding hyper-parameters that work well with a particular set of fixed seeds.

I think of this as analogous to the risk in ML of fitting hyper-parameters to a particular validation set, which is why we hold out a separate test set on which to evaluate our models after we've tuned our parameters.

## Replicating published RL results and benchmarks is really hard.

This is in part due to the points above.

Benchmark environments are often non-deterministic. Combined with the variance intrinsic to RL methods, this makes reproducing results in RL challenging.

See some of Joelle Pineau et al.'s work on this issue, with efforts to enable reproducibility in evaluating RL algorithms:
- [Deep Reinforcement Learning that Matters](https://arxiv.org/abs/1709.06560)
- [RE-EVALUATE: Reproducibility in Evaluating Reinforcement Learning Algorithms](https://openreview.net/forum?id=HJgAmITcgm)
- [Benchmarking Batch Deep Reinforcement Learning Algorithms](https://arxiv.org/abs/1910.01708)


## I got some cool results.

As a baseline, I visualized an agent that follows a random-action policy in the MaxAtar environment:

![Random agent playing Breakout](/assets/breakout_gifs/breakout_rand.gif)

We can see that it gets around 2 hits before missing.

We'd hope that the agent can do better after training a breakout-playing policy with DQN.

After matching the MinAtar environment and training configuration as closely as possible (featuring a CNN Q-Network architecture, RMSProp optimizer, Huber loss, and difficulty ramping), and training for 5 million epochs, we got a pretty good breakout-player:

![Trained agent playing breakout, seed 3214](/assets/breakout_gifs/breakout_5M_epochs_seed3214_sticky_ramping_1q.gif)

The average return and std over 10 episodes for this agent was 12.70 ± 2.76.

Just by changing the random seed, this result became 7.30 ± 0.20, going to show how noisy these methods can be and the importance of multiple trials with different seeds during evaluation. It would also be important to evaluate over more than 10 episodes.

A 5M epoch run with MinAtar gave an agent with average return over 10 episodes of 16.70 ± 4.71. Strangely, the MinAtar agent's performance had very high variance across episodes, getting 53 bricks one episode and 0 bricks in the next, in one instance.

The run with MinAtar took about ~2.5 hours on one H100 GPU, while MaxAtar took ~45 min. So, we at least achieved our goal of being a lot faster, thanks to JAX JIT compilation.

Finally, here's an agent that plays a perfect policy (until the game gets too fast for it thanks to difficulty ramping):

![Perfect-policy agent playing breakout](/assets/breakout_gifs/breakout_perfect.gif)

## What's next?

I plan to continue developing mechagogue, adding more algorithms and environments in the JAX functional style.

## Thank you

to Aaron for your help and mentorship as I learn RL and JAX.
