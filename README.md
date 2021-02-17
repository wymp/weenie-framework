Weenie Framework
=================================================================================

The Weenie Framework is a strongly typed dependency container builder for Typescript.

It was born out of a frustration with giganto-frameworks like Nest and a desire to keep things
small, light and composable, and with a special focus on empowering developers to build with it
whatever and however they wish _without the framework getting in the way._ It is designed to be
highly unopinionated and to allow developers to easily compose and encapsulate functionality in
whatever way makes sense to them.

To this end, Weenie was built like a cheap fake Christmas tree: It provides a central pole on which
you can hang just about anything. The idea is that each "branch" that you hang on the central pole
changes the definition of the pole for the branch that follows. It thus builds a dependency tree
where later dependencies may depend on earlier dependencies, and all current dependencies are both
known and strictly typed at each step.

What you hang on that dependency tree and what you do with it is entirely up to you. The example
in [`src/example.ts`](src/example.ts) is a decent look at what _I_ usually do with it and how.
That is, it demonstrates the deliberate building of a "resource bag" (a dependency injection
container), which I then use in event handlers and API request handlers to execute my core
logic.

And why go through all the trouble of doing it this way?

Frankly, this makes sense to me, and it makes each individual component much more narrowly scoped
and easier to test. Using this structure, I can mock out the entire tree for my test cases, and
I can easily encapsulate my application logic in functions that themselves have a very narrow set
of dependencies. And that allows me to focus my development and treat every component as it should
be treated - as a small, isolated unit that does one thing well and uses very few other things to
do it.

## Weenie Components

While Weenie was a response to opinionated frameworks, it does recognize that frameworks _must_ be
opinionated to be useful. Therefore, Weenie's approach is to encourage the creation of small,
relatively unopinionated framework components that can be easily composed into a larger, more
opinionated framework.

Because of that, Weenie does express opinions of its own. However, it does so via components, which
are the primary export of this library. The primary Weenie components include a config system (from
`weenie-base`), a logger (`winston`), a sql database (`mysql2`), an pubsub abstraction (`amqp`), an
HTTP Client (`request-promise-native`), an HTTP Server (`express`), and a cron system. (Most of
these components are conformant with
[Simple Interfaces](https://github.com/wymp/ts-simple-interfaces).)

These core components form the central philosophy of Weenie - that is, they are implemented in a way
that is narrowly scoped, but that does express an opinion about how Weenie likes to do things.

You are free to use them as a complete set to quickly and easily build microservices in Typescript.
However, you are also free to use some of them, or none of them, instead building your own set of
dependencies in a Weenie-compatible way. Doing so allows you to contribute to the library of
functionality that other developers can easily pull into their own code.

### How to Build a Weenie Component

A Weenie component can be just about anything. To create a Weenie component, all you have to do is
create a function with the following signature:

```ts
type Component = <ExistingDeps, NewDeps>(d: ExistingDeps) => NewDeps;
```

For very small components - a cache connection or similar - you can just in-line the definitions.
For others, it will be more convenient to build the Weenie component together with whatever
abstraction you're building. For example, if you're building a special API client for an HTTP
service, you might export both the client class and the Weenie component from that module.

## Example

As always, the best way to understand things is usually by example. There is a fully-fledged service
built in `src/example.ts`. Here it is, copied for convenience:

```ts
/**
 * Weenie Framework Example
 *
 * Ordinarily you would elaborate all this in a project structured the way you like to structure
 * things (i.e., with subfolders, maybe a Types.ts file, etc.). Here, for the sake of example,
 * we've dumped the whole thing into this one file.
 *
 * This example is intended to give you a high-level overview of how the Weenie Framework is
 * intended to be used.
 */

import {
  // Base framework function
  Weenie,

  // Config component and runtime config validators
  configFromFiles,
  baseConfigValidator,
  databaseConfigValidator,
  webServiceConfigValidator,
  apiConfigValidator,
  mqConnectionConfigValidator,

  // Other components
  logger,
  serviceManagement,
  mysql,
  httpHandler,
  amqp,
  WeeniePubSubAmqp,

  // Extra things for building the special api instantiator
  BaseApiDeps,
  ApiClient,
  ApiConfig,
} from "./";

// Runtypes for creating a final config validator
import * as rt from "runtypes";

// Some simple interfaces, used for creating our api clients (you might normally put these and the
// api client instantiation logic somewhere else, but it's all here to make the example more
// contained)
import {
  SimpleLoggerInterface,
  SimpleHttpClientInterface,
  SimpleSqlDbInterface,
} from "@wymp/ts-simple-interfaces";

/**
 * Create final config definition
 *
 * Here, we're using the "base" config defined in `src/Types.ts` (which includes things like config
 * for an exponential backoff system, an initialization system, a logger, and environment awareness)
 * and we're adding config for a database, webservice provider, and two arbitrary API clients.
 *
 * This config contains all of the keys necessary to instantiate the rest of our dependencies, and
 * in this example, we're using Weenie's native config function, which uses this validator to
 * validate config on initialization.
 */
const exampleConfigValidator = rt.Intersect(
  baseConfigValidator,
  rt.Record({
    db: databaseConfigValidator,
    webservice: webServiceConfigValidator,
    firstApi: apiConfigValidator,
    secondApi: apiConfigValidator,
    amqp: mqConnectionConfigValidator,
  })
);
declare type ExampleConfig = rt.Static<typeof exampleConfigValidator>;

// (We're going to wrap this in a top-level async function so we can make the syntax prettier)
(async () => {
  /**
   * Build the application up as we see fit
   *
   * This is the meat of what we're doing. The `r` variable (short for `resources`) will emerge from
   * this as a full dependency injection container, with each dependency correctly instantiated and
   * typed.
   *
   * Note that in this example we have one promisified dependency, which we resolve in the `done`
   * method down below. Because of that, we're awaiting here, but if by chance we don't have any
   * promisified dependencies, then of course we don't have to make this async.
   */

  /**
   * We always start with config, since that's the foundation of everything. This returns the
   * following:
   *
   * { config: ExampleConfig }
   */
  const r = await Weenie(
    // The configFromFiles method is for smaller scale projects that use on-disk config files rather
    // than environment variables for config. You can use the `configFromEnv` function if you'd like
    // to draw config from environment variables.
    configFromFiles<ExampleConfig>(
      "./config.example.json",
      "./config.local.json",
      exampleConfigValidator
    )()
  )
    /**
     * This is optional, but I always like to have a mechanism for alerting when my service has not
     * fully initialized in a reasonable amount of time. The service manager does that.
     */
    .and(serviceManagement)

    /**
     * And let's add in a long-running promise just for kicks. (Note that you can tweak your config
     * to make the service initialization timeout before this promise resolves.)
     */
    .and(() => {
      return {
        myPromise: new Promise<string>((res, rej) => setTimeout(() => res("resolved!"), 2000)),
      };
    })

    /**
     * Here we add the standard Weenie Logger. This is just a simple logger instance (winston-based)
     * with a specific configuration that is considered the "weenie" way.
     */
    .and(logger)

    /**
     * Now we'll add a pubsub
     */
    .and(amqp)

    /**
     * Next we do mysql. Nothing special here. Just a simple sql db instance specific to mysql.
     */
    .and(mysql)

    /**
     * Now we'll add our API clients. These we have to make kind of custom because it's impossible
     * to create a general function that provides both correct typing and access to the correct
     * configs without dangerous casting.
     *
     * To make it a little bit cleaner, Weenie provides the `BaseApiDeps` type, which defines an
     * environment-aware config and a logger. Then we just have to add our specific new config keys.
     */
    .and((d: BaseApiDeps & { config: { firstApi: ApiConfig; secondApi: ApiConfig } }) => {
      return {
        firstApi: new ApiClient({ envType: d.config.envType, ...d.config.firstApi }, d.logger),
        secondApi: new ApiClient({ envType: d.config.envType, ...d.config.secondApi }, d.logger),
      };
    })

    /**
     * For our IO abstraction, normally we would build this in a separate file and pull it in as a
     * module, but for this example, we'll just do it ad-hoc.
     *
     * The idea is to encapsulate all of the IO functionality we want to use here behind a defined,
     * declarative interface instead of doing raw queries, which are hard to stub out in testing.
     *
     * In this case, we're unifying both API calls and database calls into one abstraction.
     */
    .and(
      (d: {
        logger: SimpleLoggerInterface;
        firstApi: SimpleHttpClientInterface;
        secondApi: SimpleHttpClientInterface;
        sql: SimpleSqlDbInterface;
        pubsub: WeeniePubSubAmqp;
      }) => {
        return {
          io: {
            getAllDatabases: () => {
              return d.sql.query<{ Database: string }>("SHOW DATABASES");
            },

            getTodo: async (todoId: number): Promise<Todo> => {
              const res = await d.firstApi.request<Todo>({ url: `/todos/${todoId}` });
              if (res.status >= 300) {
                throw new Error(
                  `Received non 2xx status code from api call: ${JSON.stringify(res.data)}`
                );
              }
              return res.data;
            },

            getUser: async (userId: number): Promise<User> => {
              const res = await d.secondApi.request<User>({ url: `/users/${userId}` });
              if (res.status >= 300) {
                throw new Error(
                  `Received non 2xx status code from api call: ${JSON.stringify(res.data)}`
                );
              }
              return res.data;
            },
          },
        };
      }
    )

    /**
     * Now we add an HTTP request handler to handle incoming requests.
     *
     * This function provides a very thinly-wrapped express app, which we'll configure with handlers
     * later on.
     */
    .and(httpHandler)

    /**
     * Finally, when we're done adding all our dependencies, we can define a final interface and
     * seal up the bag. The `done` method simply injects the dependencies that precede it and returns
     * whatever you choose to return. This becomes the final type of the `r` variable way up above,
     * and what we use to enact our application down below.
     */
    .done(async d => {
      // We know we've got some promises to wait for, so let's wait for them before wrapping everything
      // up

      const myPromise = await d.myPromise;

      // This comes from the serviceManagement function up above
      d.svc.initialized(true);

      // Now return our sewn up bag of dependencies
      return {
        config: d.config,
        log: d.logger,
        io: d.io,
        http: d.http,
        pubsub: d.pubsub,
        myPromise,
      };
    });

  /**
   *
   *
   *
   *
   *
   *
   * Now we can use our dependencies.
   *
   * In this case, we're just exercising them a little bit for the purposes of example. We're logging
   * stuff, exploring config values, getting information from the database, setting up an endpoint
   * for getting some info, subscribing to MQ messages, and getting info from our APIs.
   *
   *
   *
   *
   *
   *
   */

  // First list available databases (just for fun)
  r.log.notice(`App started in environment '${r.config.envName}'`);
  const dbsQuery = await r.io.getAllDatabases();

  r.log.notice(`Available databases:`);
  for (let row of dbsQuery.rows) {
    r.log.notice(`* ${row.Database}`);
  }

  // Now, subscribe to all events on the 'data-events' channel
  r.pubsub.subscribe(
    { "data-events": ["*.*.*"] },
    (msg, log) => {
      // The message content has already been converted to object format for us, but remains type
      // unknown. The first thing we always need to do is validate the type, since this is a runtime
      // boundary. In this case, we're feeling lazy, so just dumping the content.
      log.notice(`Got message with id ${msg.id}: ` + JSON.stringify(msg));
      return Promise.resolve(true);
    },
    { queue: { name: r.config.serviceName } }
  );

  // Set up our webservice to handle incoming requests, and add middleware to log request info
  r.http.use((req, res, next) => {
    r.log.info(`Received request: ${req.path}`);
    next();
  });
  r.http.get("/info", async (req, res, next) => {
    try {
      // Pick a random to-do and get info about it.
      const todoId = Math.round(Math.random() * 100);

      // Get todo
      r.log.info(`Getting todo id ${todoId} from API`);
      const todo = await r.io.getTodo(todoId);
      r.log.debug(`Got response from API: ${JSON.stringify(todo)}`);

      r.log.info(`Getting user id ${todo.userId} from API`);
      const user = await r.io.getUser(todo.userId);
      r.log.debug(`Got response from API: ${JSON.stringify(user)}`);

      res.send({
        timestamp: Date.now(),
        todo,
        user,
        meta: {
          nextTodo: todo.id * 1 + 1,
          prevTodo: todo.id * 1 - 1,
        },
      });
    } catch (e) {
      res.status(500).send({
        errors: [
          {
            title: "Sorry, we screwed up",
            detail: e.message,
          },
        ],
      });
    }
  });

  // Start the app listening and we're done!
  r.http.listen();
})() // End async "init" function
  .catch(e => {
    console.error(e);
    process.exit(1);
  });

/**
 *
 *
 *
 *
 *
 *
 *
 *
 * Unimportant type definitions for the the example
 *
 *
 *
 *
 *
 *
 *
 *
 */
declare interface Todo {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

declare interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  address: Address;
  phone: string;
  website: string;
  company: Company;
}

declare interface Address {
  street: string;
  suite: string;
  city: string;
  zipcode: string;
  geo: {
    lat: string;
    lng: string;
  };
}

declare interface Company {
  name: string;
  catchPhrase: string;
  bs: string;
}
```

---

This example is pretty trivial. However, it's very functional, and it demonstrates how easy it
would be to modify the framework. Have a standard DBAL that you like? You can just write a
function that hangs it on the tree configured the way you like it, and then for any service that
you create, all you have to do is `.and(myDbal)`. Want a global cache? `.and` it in. Want an
exponential backer-offer? `.and` it in.

One of the interesting parts about this is that you can abstract whole parts of the tree away into
modules that represent your personal "way of doing things." For example, I could take the above and
wrap it into a `MyService` function, pass that to Weenie as a starting point and just start
`.and`ing from there.

Best of all, you can release lightweight functions that configure things in a useful way (logger
and config manager are ones that come mind as areas where people like to do things a variety of
different ways) and other people can incorprate those into _their_ microservices by just `.and`ing
them in.

## Future Development

For now, this framework provides just about all the functionality that I want from it. I don't have
any immediate plans for additional development, although I'm certainly open to adding more and/or
changing things. Feel free to submit an issue for any suggestions.

