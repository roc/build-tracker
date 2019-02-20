import { ArtifactFilters } from '@build-tracker/types';
import Build, { ArtifactSizes, BuildMeta } from '@build-tracker/build';
import { delta, percentDelta } from './artifact-math';

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

interface ArtifactDelta<AS extends ArtifactSizes = ArtifactSizes> {
  hashChanged: boolean;
  name: string;
  sizes: AS;
  percents: AS;
}

interface BuildSizeDelta<M extends BuildMeta = BuildMeta, AS extends ArtifactSizes = ArtifactSizes> {
  againstRevision: M['revision'];
  sizes: AS;
  percents: AS;
}

export default class BuildDelta<M extends BuildMeta = BuildMeta, A extends ArtifactSizes = ArtifactSizes> {
  private _baseBuild: Build<M, A>;
  private _prevBuild: Build<M, A>;
  private _meta: M;
  private _artifactDeltas: Map<string, ArtifactDelta<A>>;
  private _artifactFilters: ArtifactFilters;
  private _artifactNames: Set<string>;
  private _totalDelta: BuildSizeDelta<M, A>;

  public constructor(baseBuild: Build<M, A>, prevBuild: Build<M, A>, artifactFilters?: ArtifactFilters) {
    this._meta = Object.freeze(baseBuild.meta);
    this._baseBuild = baseBuild;
    this._prevBuild = prevBuild;
    this._artifactFilters = artifactFilters || [];
  }

  public get meta(): M {
    return this._meta;
  }

  public get timestamp(): Date {
    return new Date(this._meta.timestamp);
  }

  public getMetaValue(key: keyof Omit<M, 'timestamp'>): string {
    const val = this._meta[key];
    // @ts-ignore
    return typeof val === 'object' && val.hasOwnProperty('value') ? val.value : val;
  }

  public getMetaUrl(key: keyof Omit<M, 'timestamp'>): string | undefined {
    const val = this._meta[key];
    // @ts-ignore
    return typeof val === 'object' && val.hasOwnProperty('url') ? val.url : undefined;
  }

  public getArtifactDelta(name: string): ArtifactDelta {
    if (!this._artifactDeltas) {
      this.artifactDeltas;
    }
    return this._artifactDeltas.get(name);
  }

  public get artifactNames(): Set<string> {
    if (!this._artifactNames) {
      this._artifactNames = new Set();
      const mapNames = (name): void => {
        if (!this._artifactFilters.some(filter => filter.test(name))) {
          this._artifactNames.add(name);
        }
      };
      this._baseBuild.artifactNames.forEach(mapNames);
      this._prevBuild.artifactNames.forEach(mapNames);
    }
    return this._artifactNames;
  }

  public get artifactDeltas(): Array<ArtifactDelta<A>> {
    if (!this._artifactDeltas) {
      this._artifactDeltas = new Map();
      this.artifactNames.forEach(artifactName => {
        const baseArtifact = this._baseBuild.getArtifact(artifactName);
        const prevArtifact = this._prevBuild.getArtifact(artifactName);

        const sizeDeltas = prevArtifact
          ? Object.keys(prevArtifact.sizes).reduce((memo, sizeKey) => {
              memo[sizeKey] = delta(sizeKey, baseArtifact && baseArtifact.sizes, prevArtifact && prevArtifact.sizes);
              return memo;
            }, {})
          : { ...baseArtifact.sizes };

        const percentDeltas = prevArtifact
          ? Object.keys(prevArtifact.sizes).reduce((memo, sizeKey) => {
              memo[sizeKey] = percentDelta(
                sizeKey,
                baseArtifact && baseArtifact.sizes,
                prevArtifact && prevArtifact.sizes
              );
              return memo;
            }, {})
          : Object.keys(baseArtifact.sizes).reduce((memo, sizeKey) => {
              memo[sizeKey] = 0;
              return memo;
            }, {});

        this._artifactDeltas.set(artifactName, {
          name: artifactName,
          hashChanged: !baseArtifact || !prevArtifact || baseArtifact.hash !== prevArtifact.hash,
          // @ts-ignore constructed above
          sizes: sizeDeltas,
          // @ts-ignore constructed above
          percents: percentDeltas
        });
      });
    }

    return Array.from(this._artifactDeltas.values());
  }

  public get totalDelta(): BuildSizeDelta<M, A> {
    if (!this._totalDelta) {
      const baseTotals = this._baseBuild.getTotals(this._artifactFilters);
      const prevTotals = this._prevBuild.getTotals(this._artifactFilters);

      const sizes = {};
      const percents = {};
      Object.keys(baseTotals).forEach(sizeKey => {
        sizes[sizeKey] = delta(sizeKey, baseTotals, prevTotals);
        percents[sizeKey] = percentDelta(sizeKey, baseTotals, prevTotals);
      });

      this._totalDelta = {
        // @ts-ignore TODO
        againstRevision: this._prevBuild.getMetaValue('revision'),
        // @ts-ignore constructed above
        sizes,
        // @ts-ignore constructed above
        percents
      };
    }

    return this._totalDelta;
  }
}